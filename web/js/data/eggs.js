// Œufs de Pâques : certains noms de navire déclenchent un petit son (et, au baptême, un petit mot).
//
// Pour en ajouter un : une entrée dans EASTER_EGGS, et (facultatif) son fichier dans web/sons/oeufs/.
//   id      : identifiant unique
//   names   : les noms qui le déclenchent (majuscules, accents, ponctuation et article
//             « le / la / les / l' / the » en tête sont ignorés : « le nautilus » = « Nautilus »)
//   file    : web/sons/oeufs/<file>.mp3 ; sans fichier, le son synthétisé `synth` joue
//   synth   : son du jeu en secours : 'sonar', 'ghost', 'fanfare' (ou rien : silence sans fichier)
//   on      : quand il joue : 'rename' (on baptise ou rebaptise le navire), 'depart' (après la corne),
//             'arrive' (à l'arrivée au port)
//   replaceHorn : au départ, le son remplace la corne au lieu de la suivre
//   toast   : un petit mot affiché au baptême (texte français, entrée anglaise dans i18n/en.js)
//
// Seuls les navires du joueur font entendre leur œuf. Les deux premiers sont des exemples tirés de
// légendes du domaine public : à garder, changer ou retirer.
export const EASTER_EGGS = [
  { id: 'nautilus', names: ['Nautilus'], file: 'nautilus', synth: 'sonar', on: ['rename', 'depart'], toast: 'Mobilis in mobili.' },
  { id: 'hollandais', names: ['Hollandais volant', 'Hollandais Volant', 'Flying Dutchman', 'Vliegende Hollander'], file: 'hollandais', synth: 'ghost', on: ['rename', 'depart', 'arrive'], toast: 'On dit qu\'il ne touche jamais terre…' },
];

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9']+/g, ' ').trim().replace(/^(le|la|les|the) /, '').replace(/^l'/, '').replace(/'/g, '').trim();
const INDEX = new Map(EASTER_EGGS.flatMap((e) => e.names.map((n) => [norm(n), e])));

// L'œuf caché derrière ce nom, ou null.
export const eggFor = (name) => (name ? INDEX.get(norm(name)) || null : null);
