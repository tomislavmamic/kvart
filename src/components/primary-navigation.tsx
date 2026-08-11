import Link from "next/link";
import {
  PRIMARY_NAV_ITEMS,
  isNavigationItemActive,
  type SiteNavigationItem,
} from "@/lib/site-navigation";

type PrimaryNavigationProps = {
  variant: "hero" | "header" | "menu";
  pathname?: string;
  onNavigate?: () => void;
};

const NAV_CLASS = {
  hero: "grid grid-cols-2 overflow-hidden rounded-xl border border-white/30 bg-white/95 text-kamen-tinta shadow-lg sm:grid-cols-4",
  header: "flex items-center gap-4 text-sm",
  menu: "flex flex-col gap-1 text-sm",
} as const;

export function PrimaryNavigation({
  variant,
  pathname = "",
  onNavigate,
}: PrimaryNavigationProps) {
  return (
    <nav aria-label="Glavni načini sudjelovanja" className={NAV_CLASS[variant]}>
      {PRIMARY_NAV_ITEMS.map((item, index) => (
        <NavigationItem
          key={item.id}
          item={item}
          variant={variant}
          active={isNavigationItemActive(pathname, item)}
          onNavigate={onNavigate}
          index={index}
        />
      ))}
    </nav>
  );
}

function NavigationItem({
  item,
  variant,
  active,
  onNavigate,
  index,
}: {
  item: SiteNavigationItem;
  variant: PrimaryNavigationProps["variant"];
  active: boolean;
  onNavigate?: () => void;
  index: number;
}) {
  const className = navigationItemClass(variant, active, index);
  const content =
    variant === "hero" ? (
      <>
        <span className="font-bold">{item.label}</span>
        <span className="mt-0.5 text-sm text-kamen-drugi">{item.description}</span>
      </>
    ) : (
      <span className="whitespace-nowrap">{item.label}</span>
    );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

function navigationItemClass(
  variant: PrimaryNavigationProps["variant"],
  active: boolean,
  index: number,
) {
  if (variant === "hero") {
    const gridBorders = [
      "border-b border-r border-kamen-tlo sm:border-b-0",
      "border-b border-kamen-tlo sm:border-b-0 sm:border-r",
      "border-r border-kamen-tlo",
      "",
    ][index];
    return `fokus meta flex min-h-20 flex-col justify-center px-4 py-3 transition-colors hover:bg-maslina-vez ${gridBorders}`;
  }

  if (variant === "menu") {
    return `fokus meta rounded-lg px-3 py-2.5 ${
      active
        ? "bg-kamen-plitko font-medium text-kamen-tinta"
        : "text-kamen-tekst hover:bg-kamen-plitko hover:text-kamen-tinta"
    }`;
  }

  return `fokus meta flex items-center px-1 py-2 ${
    active
      ? "font-medium text-kamen-tinta"
      : "text-kamen-drugi hover:text-kamen-tinta"
  }`;
}
