"""
FFmpeg Engine — corte e reframe vertical 9:16 usando ffmpeg-python.
"""
import ffmpeg


def create_vertical_clip(input_video: str, output_video: str, start: float, end: float) -> str:
    """
    Recorta input_video de [start, end] e aplica crop centralizado 9:16.
    Retorna o caminho do output_video gerado.
    """
    duration = round(end - start, 3)

    (
        ffmpeg
        .input(input_video, ss=start, t=duration)
        .video
        .filter("crop", "ih*9/16", "ih")
        .filter("scale", 1080, 1920)
        .output(
            ffmpeg.input(input_video, ss=start, t=duration).audio,
            output_video,
            vcodec="libx264",
            preset="fast",
            crf=23,
            acodec="aac",
            audio_bitrate="128k",
            movflags="+faststart",
        )
        .overwrite_output()
        .run(quiet=True)
    )

    return output_video
