import json,subprocess
from pathlib import Path
P=Path(__file__).resolve().parent
ff=P/'composition/.hyperframes/bin/ffmpeg';probe=P/'composition/.hyperframes/bin/ffprobe'
def run(args):return subprocess.run([str(ff),'-hide_banner','-y',*args],check=True,capture_output=True,text=True)
info=json.loads(subprocess.check_output([str(probe),'-v','error','-count_frames','-show_streams','-show_format','-of','json',str(P/'brag.mp4')]))
v=next(s for s in info['streams'] if s['codec_type']=='video')
assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_read_frames']))==(1920,1080,'30/1',720),v
assert abs(float(info['format']['duration'])-24)<.12,info['format']['duration']
assert any(s['codec_type']=='audio' for s in info['streams'])
# A fully settled, product-specific hero chosen from the inspected review frames.
run(['-ss','21.83','-i',str(P/'brag.mp4'),'-frames:v','1','-q:v','2',str(P/'brag.jpg')])
run(['-i',str(P/'brag.mp4'),'-i',str(P/'brag.jpg'),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",'-map','[v]','-map','0:a?','-c:v','libx264','-crf','18','-preset','slow','-threads','2','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(P/'brag.poster.mp4')])
(P/'brag.poster.mp4').replace(P/'brag.mp4')
post=json.loads(subprocess.check_output([str(probe),'-v','error','-count_frames','-show_streams','-show_format','-of','json',str(P/'brag.mp4')]))
v2=next(s for s in post['streams'] if s['codec_type']=='video')
assert int(v2['nb_read_frames'])==720 and abs(float(post['format']['duration'])-24)<.12
sound=run(['-i',str(P/'brag.mp4'),'-af','volumedetect','-vn','-sn','-dn','-f','null','-'])
(P/'audio-analysis.txt').write_text(sound.stderr)
(P/'media-verification.json').write_text(json.dumps(post,indent=2)+'\n')
(P/'encoded-review').mkdir(exist_ok=True)
for i,t in enumerate([0,1.7,5.85,10.6,12.43,12.55,12.67,16.67,17.8,21.83]):
 run(['-ss',str(t),'-i',str(P/'brag.mp4'),'-frames:v','1','-q:v','2',str(P/'encoded-review'/f'{i:02d}-{t}.jpg')])
run(['-i',str(P/'brag.mp4'),'-vf','fps=2,scale=384:216,tile=6x8','-frames:v','1','-q:v','2',str(P/'encoded-review/contact-sheet.jpg')])
print('Verified24s/720frames/1920x1080/30fps/audio; poster baked only into frame0.')
print('\n'.join(s for s in sound.stderr.splitlines() if 'volume:' in s))
