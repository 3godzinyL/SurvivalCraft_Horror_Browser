import wave, os, math
import numpy as np
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets','audio')); SR=32000
rng=np.random.default_rng(66831)
def low(x,cut):
 a=1-math.exp(-2*math.pi*cut/SR);y=np.empty_like(x);z=0.
 for i,v in enumerate(x): z+=a*(float(v)-z);y[i]=z
 return y
def norm(x):
 m=np.max(np.abs(x)) or 1;return np.clip(x/m*.88,-1,1)
def write(name,x):
 x=norm(x)
 with wave.open(os.path.join(ROOT,name),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((x*32767).astype('<i2').tobytes())
# fire crackle
n=int(1.8*SR); t=np.arange(n)/SR; raw=rng.uniform(-1,1,n); y=low(raw,1800)*.045
for _ in range(28):
 c=int(rng.uniform(.02,1.75)*SR); L=min(n-c,int(rng.uniform(.004,.022)*SR));
 if L>0:y[c:c+L]+= (rng.uniform(-1,1,L)-low(rng.uniform(-1,1,L),650))*np.linspace(1,0,L)**2*rng.uniform(.12,.35)
y+=np.sin(2*np.pi*84*t)*(.014+.008*np.sin(2*np.pi*t*.8))
write('fire_crackle.wav',y)
# shoreline lap
n=int(2.4*SR); t=np.arange(n)/SR; raw=rng.uniform(-1,1,n); swell=np.maximum(0,np.sin(2*np.pi*t/1.15))**2
y=low(raw,700)*(.05+.13*swell)+(raw-low(raw,1100))*.022*swell
write('water_lap.wav',y)
print('done')
