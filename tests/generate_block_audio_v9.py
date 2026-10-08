from pathlib import Path
import wave, math, random
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
SR=22050

def lp(x, n):
    n=max(1,int(n))
    if n<=1:return x
    k=np.ones(n,dtype=np.float32)/n
    return np.convolve(x,k,mode='same').astype(np.float32)

def hp(x,n):
    return (x-lp(x,n)).astype(np.float32)

def env(n, attack=.01, release=.85):
    t=np.linspace(0,1,n,endpoint=False,dtype=np.float32)
    a=np.minimum(1,t/max(attack,1e-4))
    r=np.maximum(0,1-(t/max(release,1e-4)))
    return np.minimum(a,r)**1.5

def impulses(n, rng, count, decay=55):
    y=np.zeros(n,dtype=np.float32)
    for _ in range(count):
        i=rng.randrange(max(1,n-20)); amp=rng.uniform(.18,.85)
        L=min(n-i,rng.randint(10,90))
        y[i:i+L]+=amp*np.exp(-np.arange(L,dtype=np.float32)/rng.uniform(decay*.45,decay*1.3))*np.array([rng.uniform(-1,1) for _ in range(L)],dtype=np.float32)
    return y

def synth(material, action, variant):
    rng=random.Random(hash((material,action,variant,99173)) & 0xffffffff)
    dur={'hit':.115,'place':.14,'break':.32}[action]
    n=int(SR*dur); t=np.arange(n,dtype=np.float32)/SR
    noise=np.array([rng.uniform(-1,1) for _ in range(n)],dtype=np.float32)
    base=np.zeros(n,dtype=np.float32)
    # material body
    if material in ('grass','leaves'):
        body=hp(lp(noise,3),18 if material=='grass' else 10)*.62
        body+=impulses(n,rng,18 if material=='leaves' else 10,28)*.45
    elif material=='dirt':
        body=lp(noise,22)*.95 + hp(noise,8)*.14
    elif material=='mud':
        body=lp(noise,34)*1.05 + lp(noise,12)*.24
        body+=np.sin(2*np.pi*(58+variant*4)*t)*np.exp(-t*16)*.12
    elif material=='clay':
        body=lp(noise,25)*.76 + hp(noise,10)*.10 + impulses(n,rng,7,34)*.18
    elif material=='sand':
        body=hp(noise,5)*.38 + lp(noise,16)*.35
        body+=impulses(n,rng,24,18)*.32
    elif material=='snow':
        body=hp(noise,4)*.20 + lp(noise,28)*.44
        body+=impulses(n,rng,12,20)*.18
    elif material=='gravel':
        body=hp(noise,7)*.34 + lp(noise,13)*.30 + impulses(n,rng,38,20)*.52
    elif material=='cobble':
        body=lp(noise,7)*.54 + hp(noise,4)*.20 + impulses(n,rng,26,16)*.31
    elif material=='brick':
        body=lp(noise,9)*.50 + hp(noise,5)*.14 + impulses(n,rng,13,24)*.19
        body+=np.sin(2*np.pi*(245+variant*18)*t)*np.exp(-t*18)*.07
    elif material=='wood':
        body=lp(noise,14)*.42 + np.sin(2*np.pi*(170+variant*12)*t)*.16
        body+=impulses(n,rng,12,35)*.35
    elif material=='plank':
        body=lp(noise,12)*.33 + np.sin(2*np.pi*(215+variant*13)*t)*.20
        body+=impulses(n,rng,9,30)*.28
    elif material=='glass':
        body=hp(noise,4)*.12
        for f,a in [(910+variant*37,.25),(1510+variant*51,.15),(2380,.08)]:
            body+=np.sin(2*np.pi*f*t)*np.exp(-t*(9 if action=='break' else 17))*a
        body+=impulses(n,rng,20 if action=='break' else 6,14)*.20
    elif material=='metal':
        body=lp(noise,9)*.10
        for f,a in [(430+variant*31,.32),(690+variant*43,.20),(980,.10)]:
            body+=np.sin(2*np.pi*f*t)*np.exp(-t*(7 if action=='break' else 12))*a
        body+=impulses(n,rng,7,22)*.12
    elif material=='ore':
        body=lp(noise,9)*.40 + hp(noise,5)*.12 + np.sin(2*np.pi*(330+variant*26)*t)*np.exp(-t*12)*.13
        body+=impulses(n,rng,14,24)*.24
    else: # stone
        body=lp(noise,8)*.48 + hp(noise,4)*.18 + impulses(n,rng,18,18)*.24
    # action shape
    if action=='hit':
        e=env(n,.008,.96)*np.exp(-t*10.5)
        y=body*e
    elif action=='place':
        thump=np.sin(2*np.pi*(82 if material not in ('glass','metal') else 125)*t)*np.exp(-t*22)*.33
        y=(body*.48+thump)*env(n,.004,.98)*np.exp(-t*7.5)
    else:
        y=body*env(n,.004,.98)*np.exp(-t*4.0)
        # staged fragments, makes breaks less like the hit sample stretched out
        for j,off in enumerate((.00,.055,.105,.165)):
            if off>=dur:continue
            start=int(off*SR); L=n-start
            burst=np.array([rng.uniform(-1,1) for _ in range(L)],dtype=np.float32)
            burst=lp(burst, max(3, 7-j))
            y[start:]+=burst*np.exp(-np.arange(L,dtype=np.float32)/SR*(13+j*2))*(.30/(1+j*.3))
    y=np.tanh(y*1.6)
    peak=max(1e-6,float(np.max(np.abs(y))))
    y=(y/peak*.76).astype(np.float32)
    return y

def write(name, data):
    pcm=np.clip(data*32767,-32768,32767).astype('<i2')
    with wave.open(str(OUT/name),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())

materials=['grass','dirt','mud','clay','stone','cobble','brick','wood','plank','sand','snow','gravel','leaves','glass','metal','ore']
for mat in materials:
    for action in ('hit','break','place'):
        for v in (1,2):write(f'block_{action}_{mat}_{v}.wav',synth(mat,action,v))

# two physical footstep variants for every surface family
for mat in materials:
    for v in (1,2):
        x=synth(mat,'hit',v)
        # slightly softer/longer transient for a step
        x=np.pad(x,(0,int(SR*.035)))
        write(f'step_{mat}_{v}.wav',x*.66)

# item pickup: short two-note "physical" tick, original synthesis
for v in (1,2):
    n=int(SR*.17);t=np.arange(n,dtype=np.float32)/SR
    y=np.sin(2*np.pi*(420+v*35)*t)*np.exp(-t*20)*.30
    y+=np.sin(2*np.pi*(680+v*55)*np.maximum(0,t-.055))*np.exp(-np.maximum(0,t-.055)*27)*(t>.055)*.22
    rng=random.Random(500+v);noise=np.array([rng.uniform(-1,1) for _ in range(n)],dtype=np.float32)
    y+=hp(noise,5)*np.exp(-t*35)*.06
    y=np.tanh(y*1.7);y/=max(1e-6,float(np.max(np.abs(y))));write(f'item_pickup_{v}.wav',y*.62)
print('generated',len(materials)*3*2+len(materials)*2+2,'wav files')
