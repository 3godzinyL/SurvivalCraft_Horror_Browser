/** Settlement building catalog. Used by sim, deterministic stamp and UI. */
export const VILLAGE_PLANS=Object.freeze({
  house:{name:'Dom osadnika',size:[11,9],cost:{wood:90},icon:'⌂',description:'Miejsce dla dodatkowego mieszkańca i jego łóżko.'},
  wall:{name:'Mur obronny 3×3',size:[3,1],cost:{wood:27},icon:'▥',description:'Segment obrony z trzema poziomami wzmocnienia.'},
  forge:{name:'Kuźnia kowala',size:[9,9],cost:{wood:110,stone:35,iron:8},icon:'⚒',description:'Kowal przetwarza surowce na broń i wyposażenie.'},
  farmer:{name:'Chata rolnika',size:[9,7],cost:{wood:75,stone:12},icon:'♧',description:'Pracownik obsługuje uprawy i przyspiesza zbiór.'},
  farm:{name:'Zagon upraw',size:[13,11],cost:{wood:42,stone:8},icon:'✿',description:'Trzy odmiany roślin; dojrzewają, są zbierane i sadzone ponownie.'},
  guard:{name:'Strażnica',size:[9,9],cost:{wood:105,stone:40,iron:8},icon:'⚔',description:'Strażnik patroluje drogę i odpiera nocne ataki.'},
  armory:{name:'Zbrojownia',size:[9,9],cost:{wood:95,stone:35,iron:16},icon:'♜',description:'Wyposażenie obronne i lepsza ochrona wioski.'},
  granary:{name:'Spichlerz',size:[9,7],cost:{wood:85,stone:18},icon:'◈',description:'Zapas żywności i bezpieczne przechowywanie plonów.'}
});
export const VILLAGE_KIT_ID=kind=>`village_${kind}_kit`;
export const VILLAGE_KIT_KINDS=Object.freeze(Object.keys(VILLAGE_PLANS));
export function kitKindFromItem(id){const m=/^village_([a-z]+)_kit$/.exec(id||'');return m&&VILLAGE_PLANS[m[1]]?m[1]:null;}
export function villageKitCostText(kind){const c=VILLAGE_PLANS[kind]?.cost||{};return Object.entries(c).map(([k,n])=>`${n} ${ {wood:'drewna',stone:'kamienia',iron:'żelaza'}[k]||k}`).join(' + ');}
