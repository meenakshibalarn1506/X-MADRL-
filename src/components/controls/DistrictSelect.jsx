import { TN_DISTRICTS } from "@/lib/tn";
import { useLanguage } from "@/lib/i18n";

export default function DistrictSelect({ value, onChange, includeAll = true, className = "", id }) {
  const { t, lang } = useLanguage();
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        "h-9 w-full rounded-md border border-input bg-surface-1 px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-primary " +
        className
      }
    >
      {includeAll && (
        <option value="all" className="bg-surface-2 text-foreground">{t("common.allDistricts")}</option>
      )}
      {TN_DISTRICTS.map((d) => (
        <option key={d.id} value={d.id} className="bg-surface-2 text-foreground">
          {lang === "ta" ? d.nameTa : d.name}
        </option>
      ))}
    </select>
  );
}