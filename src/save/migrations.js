// Versioned, pure, lossless save migrations: old block IDs never remapped.
export const CURRENT_SAVE_VERSION=24;
export function migrateSave(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw TypeError('save must be an object');
  if(!Number.isInteger(raw.version)||raw.version<1)throw Error('Unsupported save format');
  if(raw.version>CURRENT_SAVE_VERSION)throw Error('Save comes from a newer game version');
  const next={...raw};
  if(next.slots&&!Array.isArray(next.slots))throw Error('Invalid inventory');
  if(next.edits&&!Array.isArray(next.edits))throw Error('Invalid chunk edits');
  if(next.edits){
    for(const edit of next.edits){
      if(!Array.isArray(edit)||edit.length!==2||typeof edit[0]!=='string'||
         !/^-?\d+,-?\d+,-?\d+$/.test(edit[0])||!Number.isInteger(edit[1])||edit[1]<0||edit[1]>255)
         throw Error('Invalid block edit entry');
    }
  }
  if(next.version<8&&Number.isFinite(next.worldSeconds)){
    // V7 ran a 720 s day. V8+ uses 1200 s; keep the hour/day position.
    next.worldSeconds=next.worldSeconds*1200/720;
  }
  next.version=CURRENT_SAVE_VERSION;
  return next;
}
