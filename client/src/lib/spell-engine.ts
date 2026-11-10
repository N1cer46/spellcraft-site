/**
 * Design system: «Обсерватория линий» — rule resolution is legible and deterministic.
 */
import { spellRecipes, type SpellRecipe } from "@/data/spellbook";
import { composeSpell } from "./spell-composer";
import type { InkStroke, Recognition } from "./recognizer";

export function resolveSpell(recognitions: Recognition[], strokes:InkStroke[] = []): { recipe: SpellRecipe | null; sigilId?: string; markIds: string[]; error?:string } {
  const sigils = recognitions.filter((recognition) => recognition.zone === "center").sort((a, b) => b.score - a.score);
  const sigilId = sigils[0]?.symbolId;
  const markIds = Array.from(new Set(recognitions.filter((recognition) => recognition.zone === "ring").map((recognition) => recognition.symbolId)));
  if (!sigilId) return { recipe: null, sigilId, markIds };
  const centerOf=(reading:Recognition)=>{
    const points=strokes.filter(stroke=>reading.strokeIds.includes(stroke.id)).flatMap(stroke=>stroke.points);
    if(!points.length)return null;
    return {x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,y:(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2};
  };
  const center=centerOf(sigils[0]);
  const occupied=new Set<string>();
  if(center)for(const reading of recognitions.filter(r=>r.zone==="ring")){
    const point=centerOf(reading);
    if(!point)continue;
    const dx=point.x-center.x,dy=point.y-center.y;
    // A 60-degree sector around each axis leaves diagonal drawings unassigned.
    if(Math.abs(dy)>Math.abs(dx)*Math.sqrt(3))occupied.add(dy<0?"сверху":"снизу");
    else if(Math.abs(dx)>Math.abs(dy)*Math.sqrt(3))occupied.add(dx<0?"слева":"справа");
  }
  const missing=["сверху","справа","снизу","слева"].filter(side=>!occupied.has(side));
  if(missing.length)return {recipe:null,sigilId,markIds,error:`Нужны минимум четыре распознанных знака вокруг сигила. Добавьте знаки: ${missing.join(", ")}. Затем снова замкните круг.`};
  const matching = spellRecipes.filter((recipe) => recipe.sigilId === sigilId && recipe.requiredMarkIds.every((markId) => markIds.includes(markId)) && markIds.every(id => recipe.requiredMarkIds.includes(id) || recipe.optionalMarkIds?.includes(id)));
  const recipe = matching.sort((a, b) => (b.optionalMarkIds?.filter((markId) => markIds.includes(markId)).length ?? 0) - (a.optionalMarkIds?.filter((markId) => markIds.includes(markId)).length ?? 0))[0] ?? composeSpell(sigilId, markIds);
  return { recipe, sigilId, markIds };
}
