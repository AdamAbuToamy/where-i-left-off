import ChoicePicker from "../components/ChoicePicker";
import type { Language } from "../translations";
import { currentCard } from "../lib/workflow";
import { useExperience } from "./context";
import { cardKey } from "./state";
import { label } from "./helpers";
export default function CardPicker({
  value,
  onChange,
  language,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  language: Language;
  title: string;
}) {
  const context = useExperience()!,
    cards = (context.cards?.projects || []).filter(currentCard);
  return (
    <label>
      {title}
      <ChoicePicker
        label={title}
        value={value}
        onChange={onChange}
        options={[
          { value: "", label: label(language, "اختر بطاقة", "Choose a card") },
          ...cards.map((p) => ({ value: cardKey(p.id), label: p.name })),
        ]}
      />
    </label>
  );
}
