import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Dices, Link2 } from "lucide-react";
import decks from "./data/decks.json";

const pages = [
  { title: "Bring your decks", caption: "Library → paste an Archidekt username or link." },
  { title: "Find tonight’s deck", caption: "Choose what’s shown. Browse, or pick at random." },
  { title: "Or start with precons", caption: "Official Commander precons · Curated by Archidekt" },
];
const artwork = decks.slice(0, 3);
function GuidePicture({ step }: { step: number }) {
  return <div className={`guide-picture guide-picture-${step}`} role="img" aria-label={[
    "An Archidekt username or link becomes a collection of deck artwork.",
    "Choose decks with checkmarks, then use the dice to pick one.",
    "A fan of three Commander artworks represents the official precon catalog.",
  ][step]}>
    {step === 0 && <div className="guide-input"><Link2 size={18} /><span>archidekt.com/u/your-name</span><ArrowRight size={18} /></div>}
    <div className="guide-artwork">
      {artwork.map((deck, index) => <div className="guide-art-card" key={deck.id}>
        <img src={deck.commanders[0].art} alt="" />
        {step === 1 && <span className={`guide-check ${index === 1 ? "guide-check-off" : ""}`}>{index !== 1 && <Check size={16} />}</span>}
      </div>)}
    </div>
    {step === 1 && <div className="guide-dice"><Dices size={25} /><span>Pick a deck</span></div>}
  </div>;
}
/** The three-page visual guide, shown as Help's Start here section. */
export default function CollectionGuide({ present, onPrecons }: {
  present: boolean; onPrecons: () => void;
}) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);
  return <div className="collection-guide">
    <GuidePicture step={step} />
    <h3 ref={heading} tabIndex={-1}>{pages[step].title}</h3>
    <p>{pages[step].caption}</p>
    <div className="guide-progress" aria-label={`Page ${step + 1} of 3`}>
      {pages.map((page, index) => <span key={page.title} className={index === step ? "active" : ""} />)}
    </div>
    <div className="guide-actions">
      {step > 0 ? <button className="button button-outline" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button> : <span />}
      {step < 2 ? <button className="button button-gold" onClick={() => setStep(step + 1)}>Next <ArrowRight size={16} /></button> :
        <button className="button button-gold" onClick={onPrecons}>{present ? "View official precons" : "Add official precons"} <ArrowRight size={16} /></button>}
    </div>
  </div>;
}
