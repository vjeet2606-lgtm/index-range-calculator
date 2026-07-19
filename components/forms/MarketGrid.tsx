"use client";

import { Landmark, Gem, Globe, Bitcoin } from "lucide-react";
import MarketCard, { type MarketCardAccent } from "@/components/cards/MarketCard";
import NseIllustration from "@/components/illustrations/NseIllustration";
import McxIllustration from "@/components/illustrations/McxIllustration";
import ForexIllustration from "@/components/illustrations/ForexIllustration";
import CryptoIllustration from "@/components/illustrations/CryptoIllustration";
import { getMarket } from "@/lib/markets/registry";
import type { MarketId } from "@/lib/markets/types";
import { handleGridArrowNav } from "@/lib/gridKeyboardNav";

const MARKET_CARD_ORDER: MarketId[] = ["NSE", "MCX", "CURRENCY", "CRYPTO"];

const MARKET_CARD_META: Record<
  string,
  {
    icon: typeof Landmark;
    accent: MarketCardAccent;
    subtitle: string;
    description: string;
    tag: string;
    illustration: React.ReactNode;
  }
> = {
  NSE: {
    icon: Landmark,
    accent: "primary",
    subtitle: "Options",
    description: "Index & Stock Options",
    tag: "Indian Derivatives",
    illustration: <NseIllustration />,
  },
  MCX: {
    icon: Gem,
    accent: "gold",
    subtitle: "Commodities",
    description: "Metals • Energy • Agro",
    tag: "Global Commodities",
    illustration: <McxIllustration />,
  },
  CURRENCY: {
    icon: Globe,
    accent: "blue",
    subtitle: "/ Currency",
    description: "Currency Markets",
    tag: "Global FX Markets",
    illustration: <ForexIllustration />,
  },
  CRYPTO: {
    icon: Bitcoin,
    accent: "purple",
    subtitle: "Markets",
    description: "Digital Assets",
    tag: "BTC • ETH & More",
    illustration: <CryptoIllustration />,
  },
};

type Props = {
  value: MarketId;
  onChange: (marketId: MarketId) => void;
};

export default function MarketGrid({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" onKeyDown={handleGridArrowNav}>
      {MARKET_CARD_ORDER.map((marketId) => {
        const market = getMarket(marketId);
        const meta = MARKET_CARD_META[marketId];
        return (
          <MarketCard
            key={marketId}
            icon={meta.icon}
            name={market.name}
            subtitle={meta.subtitle}
            description={meta.description}
            tag={meta.tag}
            accent={meta.accent}
            illustration={meta.illustration}
            isActive={value === marketId}
            onSelect={() => onChange(marketId)}
          />
        );
      })}
    </div>
  );
}
