#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'assets/hero/worldmind-cover.png','assets/showcase/worldmind-v2-showcase.png','assets/maps/new-aarhus-district-map.png',
  'assets/ui/evidence-card.png','assets/ui/rumor-card.png','assets/ui/memory-node.png','assets/ui/relationship-edge.png','assets/ui/incident-alert.png','assets/ui/leno-overlay.png','assets/ui/command-button.png',
  'assets/locations/cafe.png','assets/locations/market.png','assets/locations/workshop.png','assets/locations/district-square.png','assets/locations/apartment.png',
  'assets/factions/registry/logo.png','assets/factions/black-circuit/logo.png','assets/factions/garden/logo.png','assets/factions/tek-guild/logo.png','assets/factions/harbor-union/logo.png','assets/factions/free-agents/logo.png',
  'assets/items/leno-core/icon.png','assets/items/coffee-supply/icon.png','assets/items/bread-supply/icon.png','assets/items/delivery-crate/icon.png','assets/items/encrypted-skill-chip/icon.png',
  'assets/badges/truth-seeker.png','assets/badges/mediator.png','assets/badges/founder.png','assets/loading/new-aarhus-rain.png',
  'content/episodes/the-missing-delivery/episode.json','content/episodes/noise-along-the-quay/episode.json','content/episodes/ownership-dispute/episode.json'
];
const chars=['sara','malik','rune','amina','nadia','player','omar','lina','yasin','freja','elias'];
for (const c of chars) for (const f of ['portrait.png','avatar.png','expression-neutral.png','expression-focused.png','expression-worried.png','expression-concerned.png']) required.push(`assets/characters/${c}/${f}`);
let missing=[]; for (const f of required) if (!fs.existsSync(path.join(root,f))) missing.push(f);
let missingWebp=[]; function walk(dir){ for (const ent of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,ent.name); if(ent.isDirectory()) walk(p); else if(p.endsWith('.png')){ const webp=p.replace(/\.png$/,'.webp'); if(!fs.existsSync(webp)) missingWebp.push(path.relative(root,webp)); } } }
walk(path.join(root,'assets'));
let badJson=[]; function walkJson(dir){ for(const ent of fs.readdirSync(dir,{withFileTypes:true})){ const p=path.join(dir,ent.name); if(ent.isDirectory()) walkJson(p); else if(p.endsWith('.json')){ try{JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){badJson.push(path.relative(root,p))} } } }
if(fs.existsSync(path.join(root,'content'))) walkJson(path.join(root,'content'));
for(const f of ['ASSET_PRODUCTION_MANIFEST.json','ASSET_QA_REPORT.json']) if(fs.existsSync(path.join(root,f))){ try{JSON.parse(fs.readFileSync(path.join(root,f),'utf8'))}catch(e){badJson.push(f)} }
const result={ok:missing.length===0&&missingWebp.length===0&&badJson.length===0, required:required.length, missing, missingWebp, badJson};
console.log(JSON.stringify(result,null,2));
process.exit(result.ok?0:1);
