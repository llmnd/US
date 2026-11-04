import type { SelectHTMLAttributes } from "react";

const units = [
  ["kg", "Kilogrammes (kg)"],
  ["g", "Grammes (g)"],
  ["tonnes", "Tonnes"],
  ["litres", "Litres"],
  ["ml", "Millilitres (ml)"],
  ["litre", "Litre"],
  ["œufs", "Œufs"],
  ["œuf", "Œuf"],
  ["têtes", "Têtes"],
  ["tête", "Tête"],
  ["unités", "Unités"],
  ["unité", "Unité"],
  ["sacs", "Sacs"],
  ["sac", "Sac"],
  ["bottes", "Bottes"],
  ["boîtes", "Boîtes"],
  ["caisses", "Caisses"],
  ["pots", "Pots"],
  ["pot", "Pot"],
  ["bidons", "Bidons"],
  ["paquets", "Paquets"],
  ["plateaux", "Plateaux"],
  ["sachets", "Sachets"],
  ["pièces", "Pièces"],
  ["hectares", "Hectares"],
  ["m²", "Mètres carrés (m²)"],
] as const;

type MeasurementUnitSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  defaultValue?: string;
  includeEmpty?: boolean;
};

export function MeasurementUnitSelect({
  defaultValue,
  includeEmpty = false,
  ...props
}: MeasurementUnitSelectProps) {
  const hasLegacyUnit = defaultValue && !units.some(([value]) => value === defaultValue);

  return (
    <select defaultValue={defaultValue ?? (includeEmpty ? "" : "unités")} {...props}>
      {includeEmpty ? <option value="">Aucune unité</option> : null}
      {hasLegacyUnit ? <option value={defaultValue}>{defaultValue} (valeur existante)</option> : null}
      {units.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
