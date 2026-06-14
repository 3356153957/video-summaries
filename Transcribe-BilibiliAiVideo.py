import argparse
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from faster_whisper import WhisperModel


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
)


def fetch_json(url, referer):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": referer,
            "Accept": "application/json, text/plain, */*",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def get_video_info(bvid):
    referer = f"https://www.bilibili.com/video/{bvid}"
    view = fetch_json(
        f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}",
        referer,
    )
    if view.get("code") != 0:
        raise RuntimeError(f"view API failed: {view.get('code')} {view.get('message')}")
    data = view["data"]
    page = data["pages"][0]
    playurl = fetch_json(
        "https://api.bilibili.com/x/player/playurl"
        f"?bvid={bvid}&cid={page['cid']}&fnval=16&fourk=1",
        referer,
    )
    if playurl.get("code") != 0:
        raise RuntimeError(f"playurl API failed: {playurl.get('code')} {playurl.get('message')}")
    audio = playurl.get("data", {}).get("dash", {}).get("audio", [])
    if not audio:
        raise RuntimeError("no DASH audio stream found")
    best_audio = sorted(audio, key=lambda item: int(item.get("bandwidth") or 0), reverse=True)[0]
    return {
        "bvid": bvid,
        "title": data.get("title", ""),
        "owner": data.get("owner", {}).get("name", ""),
        "desc": data.get("desc", ""),
        "duration": data.get("duration", 0),
        "cid": page["cid"],
        "audio_url": best_audio.get("baseUrl") or best_audio.get("base_url"),
    }


def run_ffmpeg(info, wav_path):
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    headers = f"Referer: https://www.bilibili.com/video/{info['bvid']}\r\nUser-Agent: {USER_AGENT}\r\n"
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-headers",
        headers,
        "-i",
        info["audio_url"],
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(wav_path),
    ]
    subprocess.run(command, check=True)


def write_transcript(info, segments, transcript_path):
    transcript_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {info['title']}",
        "",
        f"- BVID: {info['bvid']}",
        f"- UP: {info['owner']}",
        f"- Duration: {info['duration']} seconds",
        "",
        "## Transcript",
        "",
    ]
    plain_lines = []
    for segment in segments:
        start = time.strftime("%H:%M:%S", time.gmtime(segment.start))
        end = time.strftime("%H:%M:%S", time.gmtime(segment.end))
        text = segment.text.strip()
        if not text:
            continue
        lines.append(f"[{start} - {end}] {text}")
        plain_lines.append(text)
    transcript_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    transcript_path.with_suffix(".txt").write_text("\n".join(plain_lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("bvid")
    parser.add_argument("--model", default="base")
    parser.add_argument("--output-dir", default="bilibili-ai-transcripts")
    parser.add_argument("--keep-wav", action="store_true")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    wav_path = output_dir / f"{args.bvid}.wav"
    info_path = output_dir / f"{args.bvid}.json"
    transcript_path = output_dir / f"{args.bvid}.md"

    print(f"Fetching Bilibili metadata: {args.bvid}", flush=True)
    info = get_video_info(args.bvid)
    info_path.parent.mkdir(parents=True, exist_ok=True)
    safe_info = {key: value for key, value in info.items() if key != "audio_url"}
    info_path.write_text(json.dumps(safe_info, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Extracting audio: {info['title']}", flush=True)
    run_ffmpeg(info, wav_path)

    print(f"Loading faster-whisper model: {args.model}", flush=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    print("Transcribing...", flush=True)
    segments_iter, detected = model.transcribe(
        str(wav_path),
        language="zh",
        vad_filter=True,
        beam_size=5,
    )
    segments = list(segments_iter)
    write_transcript(info, segments, transcript_path)

    if not args.keep_wav:
        try:
            wav_path.unlink()
        except FileNotFoundError:
            pass

    print(json.dumps({
        "bvid": args.bvid,
        "title": info["title"],
        "language": detected.language,
        "language_probability": detected.language_probability,
        "segments": len(segments),
        "transcript": str(transcript_path),
    }, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
