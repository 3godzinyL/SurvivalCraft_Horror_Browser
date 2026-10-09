import {VILLAGE_PLANS,villageKitCostText} from '../world/village-plans.js';
// A searchable, fully data-driven 3×3 illustrated recipe book.
export function install(S){
  const panel=document.getElementById('recipeCodex'),openBtn=document.getElementById('recipeBookBtn'),closeBtn=document.getElementById('closeRecipeCodex'),list=document.getElementById('codexRecipes'),search=document.getElementById('codexSearch'),all=document.getElementById('codexAll'),ready=document.getElementById('codexReady'),upgrades=document.getElementById('codexUpgrades'),buildings=document.getElementById('codexBuildings');
  S.recipeCodexOpen=false;S.codexReadyOnly=false;S.codexMode='recipes';
  S.closeRecipeCodex=function(){S.recipeCodexOpen=false;panel.classList.add('hidden');openBtn.classList.remove('active');};
  S.openRecipeCodex=function(){if(!S.inventoryOpen)return;S.recipeCodexOpen=true;panel.classList.remove('hidden');openBtn.classList.add('active');S.refreshRecipeCodex();search.focus();};
  S.refreshRecipeCodex=function(){
    if(!S.recipeCodexOpen)return;
    list.replaceChildren();const q=(search.value||'').toLocaleLowerCase('pl').trim();
    for(const [mode,button] of [['upgrades',upgrades],['buildings',buildings]])button?.classList.toggle('active',S.codexMode===mode);
    all.classList.toggle('active',S.codexMode==='recipes'&&!S.codexReadyOnly);
    ready.classList.toggle('active',S.codexMode==='recipes'&&S.codexReadyOnly);
    if(S.codexMode!=='recipes'){
      const entries=S.codexMode==='upgrades' ? [
        ['DREWNO → ŻELAZO','Żywotność bloku rośnie w 6 fazach', ['LVL 0 · drewno 80 HP','LVL 1 · wzmocnione drewno 135 HP','LVL 2 · bruk 220 HP','LVL 3 · kamień 320 HP','LVL 4 · cegła 455 HP','LVL 5 · żelazo 700 HP']],
        ['WZMOCNIONE ŚCIANY','Specjalne bloki z receptur: drewno, bruk, kamień, żelazo', ['0 · bazowa ściana','1 · koszt 3 bloki','2 · koszt 6 bloków','3 · koszt 9 bloków']],
        ['SEGMENT MURU 3×3','Ulepszany u Aldryka za jedną opłatą dla 9 bloków', ['LVL 1 · 18 drewna + 8 kamienia','LVL 2 · 12 drewna + 22 kamienia','LVL 3 · 18 drewna + 35 kamienia + 10 żelaza']]
      ] : Object.entries(VILLAGE_PLANS).map(([kind,p])=>[p.icon+' '+p.name,p.description,[`${p.size.join('×')} bloków`,villageKitCostText(kind)]]);
      for(const [title,description,stages] of entries){
        if(q&&!`${title} ${description} ${stages.join(' ')}`.toLocaleLowerCase('pl').includes(q))continue;
        const entry=document.createElement('article');entry.className='codex-entry-catalog';
        const info=document.createElement('div');const name=document.createElement('strong');name.textContent=title;
        const details=document.createElement('small');details.textContent=description;
        const row=document.createElement('div');row.className='codex-stage-line';
        for(const stage of stages){const stageEl=document.createElement('span');stageEl.className='codex-stage';stageEl.textContent=stage;row.append(stageEl);}
        if(S.codexMode==='upgrades'){
          const family=['planks','reinforced_wood','reinforced_cobble','reinforced_stone','reinforced_iron'];
          const swatches=document.createElement('div');swatches.className='codex-swatch-row';
          for(const block of family)if(S.itemDefs[block]){
            const holder=document.createElement('div');holder.className='codex-product';holder.title=S.itemDefs[block].name;
            holder.append(S.itemIconCanvas(block));swatches.append(holder);
          }
          info.append(swatches);
        }
        info.append(name,details,row);entry.append(info);list.append(entry);
      }
      return;
    }

    let shown=0;
    for(let index=0;index<S.recipes.length;index++){
      const r=S.recipes[index],out=Object.keys(r.out)[0],available=S.canFillCraftRecipe(r);
      if(S.codexReadyOnly&&!available)continue;
      const ingredients=S.recipeIngredients(r),keywords=r.name+' '+out+' '+ingredients.map(v=>S.recipeLabel(v.spec)).join(' ');
      if(q&&!keywords.toLocaleLowerCase('pl').includes(q))continue;
      shown++;
      const entry=document.createElement('article');entry.className='codex-entry'+(available?' available':'');
      const icon=document.createElement('div');icon.className='codex-product';icon.append(S.itemIconCanvas(out));
      const info=document.createElement('div');info.className='codex-description';
      const title=document.createElement('strong');title.textContent=r.name;
      const cost=document.createElement('small');cost.textContent=S.requirementTextForRecipe(r);
      const grid=document.createElement('div');grid.className='codex-pattern';
      const pat=r.pattern||[];const glyph=(r.shapeless?Object.entries(r.shapeless).flatMap(([key,n])=>Array(n).fill(key)):null);
      for(let y=0;y<3;y++)for(let x=0;x<3;x++){
        const cell=document.createElement('div');cell.className='codex-cell';
        let id;
        if(glyph)id=glyph[y*3+x];
        else {const row=pat[y]||'';const character=row[x]||' ';const raw=r.key?.[character];id=Array.isArray(raw)?raw[0]:raw;}
        if(id){cell.append(S.itemIconCanvas(id));cell.title=S.itemDefs[id]?.name||id;}
        grid.append(cell);
      }
      const action=document.createElement('button');action.textContent=available?'UŁÓŻ →':'BRAK MATERIAŁÓW';action.disabled=!available;
      action.onclick=()=>{S.closeRecipeCodex();S.fillCraftFromRecipe(r);};
      info.append(title,cost,action);entry.append(icon,grid,info);list.append(entry);
    }
    if(!shown){const empty=document.createElement('p');empty.className='codex-empty';empty.textContent='Brak receptur dla tych filtrów.';list.append(empty);}
    all.classList.toggle('active',!S.codexReadyOnly);ready.classList.toggle('active',S.codexReadyOnly);
  };
  openBtn.onclick=()=>S.recipeCodexOpen?S.closeRecipeCodex():S.openRecipeCodex();
  closeBtn.onclick=S.closeRecipeCodex;
  search.addEventListener('input',S.refreshRecipeCodex);
  all.onclick=()=>{S.codexMode='recipes';S.codexReadyOnly=false;S.refreshRecipeCodex();};
  ready.onclick=()=>{S.codexMode='recipes';S.codexReadyOnly=true;S.refreshRecipeCodex();};
  upgrades.onclick=()=>{S.codexMode='upgrades';S.refreshRecipeCodex();};
  buildings.onclick=()=>{S.codexMode='buildings';S.refreshRecipeCodex();};
}
