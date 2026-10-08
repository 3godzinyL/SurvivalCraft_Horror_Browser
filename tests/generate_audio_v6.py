import wave, math, random, os
import numpy as np
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','assets','audio'))
SR=32000
rng=np.random.default_rng(0xC0FFEE)

def env(n, attack=.005, decay=.16):
    t=np.arange(n)/SR
    e=np.ones(n)
    if attack>0: e=np.minimum(1,t/attack)
    e*=np.exp(-np.maximum(0,t-attack)/max(decay,1e-4))
    return e

def onepole_low(x, cutoff):
    a=1-math.exp(-2*math.pi*cutoff/SR)
    y=np.empty_like(x); z=0.0
    for i,v in enumerate(x):
        z += a*(float(v)-z); y[i]=z
    return y

def onepole_high(x, cutoff):
    return x-onepole_low(x,cutoff)

def norm(x, peak=.92):
    x=np.asarray(x,dtype=np.float64)
    m=np.max(np.abs(x)) or 1
    return np.clip(x/m*peak,-1,1)

def write(name,x):
    x=norm(x)
    p=os.path.join(ROOT,name)
    with wave.open(p,'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR)
        w.writeframes((x*32767).astype('<i2').tobytes())

def noise(n): return rng.uniform(-1,1,n)
def sine(freq,n,phase=0): return np.sin(2*np.pi*freq*np.arange(n)/SR+phase)

def click_train(n, count, lo=.15, hi=.85, amp=.35):
    y=np.zeros(n)
    for _ in range(count):
        c=int(rng.uniform(lo,hi)*n); L=int(rng.uniform(.002,.011)*SR); end=min(n,c+L)
        if end<=c: continue
        burst=noise(end-c)*np.linspace(1,0,end-c)**2
        y[c:end]+=burst*amp*rng.uniform(.6,1.15)
    return y

def step(material):
    dur={'grass':.19,'dirt':.18,'stone':.15,'wood':.17,'sand':.21,'snow':.22}[material]
    n=int(dur*SR); raw=noise(n); e=env(n,.002,dur*.48)
    if material=='grass':
        y=onepole_high(onepole_low(raw,4200),650)*.46 + click_train(n,11,.03,.88,.22)
        y+=onepole_low(raw,360)*.17
    elif material=='dirt':
        y=onepole_low(raw,1500)*.55 + click_train(n,7,.02,.68,.17)+sine(88,n)*env(n,.001,.055)*.16
    elif material=='stone':
        y=onepole_high(raw,900)*.30 + sine(132,n)*env(n,.001,.045)*.34 + sine(266,n)*env(n,.001,.025)*.12
    elif material=='wood':
        y=sine(118,n)*env(n,.001,.07)*.42+sine(236,n)*env(n,.001,.045)*.16+onepole_low(raw,1000)*.25
    elif material=='sand':
        y=onepole_high(onepole_low(raw,2600),300)*.48+click_train(n,15,.03,.92,.10)
    else:
        y=onepole_high(onepole_low(raw,3800),900)*.35+onepole_low(raw,900)*.32+click_train(n,8,.05,.9,.08)
    y*=e
    write(f'step_{material}.wav',y)
for m in ['grass','dirt','stone','wood','sand','snow']: step(m)

def impact(name,dur,lowf,cut,crunch=.4,tail=.2):
    n=int(dur*SR); raw=noise(n)
    y=sine(lowf,n)*env(n,.001,dur*.22)*.46 + onepole_low(raw,cut)*env(n,.001,dur*.44)*crunch
    y+=onepole_high(raw,cut*.75)*env(n,.001,dur*.18)*.18
    if tail: y+=click_train(n,6,.12,.82,.13)*env(n,.001,dur*.7)*tail
    write(name,y)
impact('block_hit.wav',.12,96,1300,.45,.35)
impact('block_break.wav',.31,72,1800,.57,.8)
impact('block_place.wav',.15,105,1150,.38,.15)
impact('mob_hit.wav',.18,83,1000,.45,.3)

# Hurt: low body thump + short breath/noise, no arcade beep.
n=int(.34*SR); raw=noise(n); y=sine(61,n)*env(n,.001,.11)*.55+onepole_low(raw,520)*env(n,.003,.20)*.33
y+=onepole_high(raw,900)*env(n,.004,.08)*.10
write('hurt.wav',y)

# Torch placement: wooden tap, match flare and tiny crackles.
n=int(.40*SR); raw=noise(n); y=sine(146,n)*env(n,.001,.055)*.24+onepole_high(raw,1500)*env(n,.010,.16)*.28
for pos in [.17,.23,.30,.34]:
    c=int(pos*SR); L=min(n-c,int(.026*SR));
    if L>0:y[c:c+L]+=onepole_high(noise(L),1900)*np.linspace(1,0,L)*.15
write('torch_place.wav',y)

# Chest creak / latch.
n=int(.84*SR); t=np.arange(n)/SR; raw=onepole_low(noise(n),900); y=np.zeros(n)
f=78+26*np.sin(2*np.pi*t/.84)
y += np.sin(2*np.pi*np.cumsum(f)/SR)*np.sin(np.pi*np.clip(t/.84,0,1))**1.3*.18
y += raw*np.sin(np.pi*np.clip(t/.84,0,1))*.18
for pos in [.04,.66]:
    c=int(pos*SR); L=min(n-c,int(.10*SR)); y[c:c+L]+=sine(118,L)*env(L,.001,.035)*.34+onepole_low(noise(L),1400)*env(L,.001,.05)*.22
write('chest.wav',y)

# Heartbeat: natural-ish lub-dub pair.
n=int(.62*SR); y=np.zeros(n)
for pos,f,a,d in [(0.02,48,.60,.075),(.18,58,.43,.060)]:
    c=int(pos*SR); L=min(n-c,int(.17*SR)); tt=np.arange(L)/SR
    pulse=(np.sin(2*np.pi*f*tt)+.38*np.sin(2*np.pi*f*2.05*tt))*np.exp(-tt/d)
    pulse+=onepole_low(noise(L),250)*np.exp(-tt/(d*.75))*.10
    y[c:c+L]+=pulse*a
write('heartbeat.wav',y)

# Evening ambience: breeze, leaf hiss, crickets and rare distant bird/owlish notes.
dur=45; n=dur*SR; raw=noise(n); low=onepole_low(raw,420); high=onepole_high(onepole_low(raw,5200),1400)
t=np.arange(n)/SR; gust=(.38+.22*np.sin(2*np.pi*t/8.7)+.13*np.sin(2*np.pi*t/3.9+1.2))
y=low*.11*gust+high*.025*(.7+.3*np.sin(2*np.pi*t/5.1))
rr=random.Random(93011)
for _ in range(64):
    st=rr.uniform(.8,dur-.25); L=int(rr.uniform(.055,.13)*SR); c=int(st*SR); tt=np.arange(L)/SR
    freq=rr.uniform(3200,5100); chirp=np.sin(2*np.pi*(freq*tt+rr.uniform(300,1200)*tt*tt))*np.sin(np.pi*np.clip(tt/(L/SR),0,1))**2
    y[c:c+L]+=chirp*rr.uniform(.018,.045)
for st,freq in [(11.7,510),(28.6,430),(38.2,620)]:
    L=int(.85*SR); c=int(st*SR); tt=np.arange(L)/SR; call=np.sin(2*np.pi*(freq*tt-45*tt*tt))*np.exp(-tt/1.1)*np.sin(np.pi*np.clip(tt/.85,0,1))
    y[c:c+L]+=call*.018
write('evening_ambience.wav',y)

# Slightly richer wind gust.
n=int(2.6*SR); raw=noise(n); t=np.arange(n)/SR; y=(onepole_low(raw,680)*.18+onepole_high(onepole_low(raw,2600),700)*.045)*np.sin(np.pi*t/2.6)**1.5
write('wind_gust.wav',y)
print('generated',ROOT)
