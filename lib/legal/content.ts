import {
  Info,
  Calculator,
  AlertTriangle,
  FileWarning,
  FileText,
  Lock,
  Database,
  ShieldCheck,
  LifeBuoy,
  Tag,
  type LucideIcon,
} from "lucide-react";

export type LegalSection = {
  heading?: string;
  paragraphs: string[];
  /** "founder"/"copyright" get bespoke premium typography instead of the
   *  generic paragraph rendering — see LegalPageModal.tsx. */
  variant?: "founder" | "copyright";
};

export type LegalPage = {
  id: string;
  title: string;
  icon: LucideIcon;
  sections: LegalSection[];
};

/**
 * All copy here describes LYNX ONE consistently as a mathematical / quantitative
 * market calculator, never as an AI, signal generator, prediction platform, or
 * advisory service — and never states or implies guaranteed accuracy or trading
 * outcomes. Nothing in this file is investment advice. This is a solid first
 * draft appropriate for the product as actually implemented; it should still be
 * reviewed by a qualified professional before being relied on for legal or
 * regulatory purposes.
 */
export const LEGAL_PAGES: LegalPage[] = [
  {
    id: "about",
    title: "About LYNX ONE",
    icon: Info,
    sections: [
      {
        paragraphs: [
          "LYNX ONE is a mathematical market calculator for options traders across NSE indices, NSE stocks, MCX commodities, and currency derivatives.",
          "It calculates values such as the underlying's calculated lower/upper level and option premium re-pricing using live market data — spot price, option chain premiums, Greeks (Delta, Gamma, Theta, Vega), implied volatility, and time to expiry — combined with standard, documented quantitative option-pricing formulas.",
          "LYNX ONE is not an artificial intelligence system, not a signal generator, and not a trading advisory service. Every number it displays is the direct output of a mathematical formula, never a prediction or a recommendation.",
          "Live data is sourced only from a broker account you connect yourself; manual entry of Spot, CE Premium, and PE Premium is always available as an alternative.",
        ],
      },
      {
        variant: "founder",
        paragraphs: ["VISHV JEET VINOD CHOUBISA", "Founder & Product Architect"],
      },
      {
        variant: "copyright",
        paragraphs: ["© 2026 LYNX ONE®", "Created and Designed by", "VISHV JEET VINOD CHOUBISA", "All Rights Reserved."],
      },
    ],
  },
  {
    id: "mathematical-calculator-notice",
    title: "Mathematical Calculator Notice",
    icon: Calculator,
    sections: [
      {
        paragraphs: [
          "All figures shown in LYNX ONE — including Calculated Lower/Upper Level, Calculated Premium, and every value in a Calculation Breakdown — are the output of deterministic mathematical formulas applied to the inputs available at the time of calculation.",
        ],
      },
      {
        heading: "Methods used",
        paragraphs: [
          "Underlying levels use the standard \"expected move\" formula: Spot × Implied Volatility × √(Time to Expiry ÷ 365), falling back to the ATM straddle premium when implied volatility isn't available.",
          "Option premium re-pricing uses a second-order Delta-Gamma Taylor approximation, with Theta and Vega contributions shown explicitly — including when they are zero, and why.",
        ],
      },
      {
        heading: "Known limitations",
        paragraphs: [
          "These are well-established, widely taught approximation methods, not proprietary predictive models. Like any approximation, they become less precise for very large price moves or long time horizons.",
          "They do not account for bid/ask spread, order execution, liquidity, or changes in implied volatility beyond what you provide as an input.",
          "A calculation reflects only the inputs available at the moment it ran. Press Refresh Calculation, or enable Auto Refresh in Settings, to recompute from the latest available data.",
        ],
      },
    ],
  },
  {
    id: "risk-disclosure",
    title: "Risk Disclosure",
    icon: AlertTriangle,
    sections: [
      {
        paragraphs: [
          "Trading in options, equities, commodities, and currency derivatives carries substantial risk of financial loss and is not suitable for every investor.",
          "Values displayed by LYNX ONE are mathematical estimates based on inputs available at calculation time. They are not a guarantee of how an option's premium, or the underlying's price, will actually behave.",
          "Live market data depends on your connected broker's feed and can be delayed, incomplete, or temporarily unavailable. Manually entered inputs are only as accurate as the values you provide.",
          "You are solely responsible for any trading or investment decisions you make. LYNX ONE does not place trades, hold positions, or manage funds on your behalf, and nothing it displays should be treated as a recommendation to buy or sell any instrument.",
        ],
      },
    ],
  },
  {
    id: "disclaimer",
    title: "Disclaimer",
    icon: FileWarning,
    sections: [
      {
        paragraphs: [
          "LYNX ONE is provided \"as is\" and \"as available,\" without warranty of any kind, express or implied, including as to accuracy, completeness, reliability, or fitness for a particular purpose.",
          "Market data displayed originates from your connected broker or your own manual entry; LYNX ONE does not independently verify its accuracy or timeliness.",
          "To the fullest extent permitted by law, LYNX ONE, its developers, and its operators are not liable for any loss or damage — financial or otherwise — arising from your use of, or inability to use, the calculator, or from any decision made in reliance on its output.",
          "Nothing in LYNX ONE constitutes investment, financial, tax, or legal advice.",
        ],
      },
    ],
  },
  {
    id: "terms-of-use",
    title: "Terms of Use",
    icon: FileText,
    sections: [
      {
        paragraphs: [
          "By using LYNX ONE, you agree to use it only as a calculation and informational tool, for your own personal, non-commercial use.",
          "You are responsible for the broker API credentials you connect and for complying with your broker's own terms of service and API usage policies. LYNX ONE never asks for, and never needs, your broker account password.",
          "You agree not to redistribute, resell, reverse-engineer, or represent LYNX ONE's calculated output as investment advice or as the product of a third party.",
          "LYNX ONE is offered without any guarantee of uptime, availability, or continued support, and its features may change over time.",
          "Continued use of LYNX ONE after changes to these Terms constitutes acceptance of the updated Terms.",
        ],
      },
    ],
  },
  {
    id: "privacy-policy",
    title: "Privacy Policy",
    icon: Lock,
    sections: [
      {
        paragraphs: [
          "Broker credentials you connect (e.g. Client ID and Access Token) are encrypted (AES-256-GCM) and stored only in a secure, server-side, httpOnly session — never in your browser's local storage, and never visible in plain text.",
          "Your device's local storage is used only for non-sensitive app preferences and workflow state: selected market and instrument, manually entered calculator values, and your Haptic Feedback / Auto Refresh preferences. This data never leaves your device.",
          "LYNX ONE does not sell your data, and does not share your broker credentials or calculated results with third parties.",
          "Disconnecting a broker clears its session immediately; you can disconnect at any time from the header's Broker Manager.",
        ],
      },
    ],
  },
  {
    id: "data-sources",
    title: "Data Sources",
    icon: Database,
    sections: [
      {
        paragraphs: [
          "Live market data (spot price, option chain, Greeks, implied volatility) is fetched directly from the broker account you connect, using that broker's official API.",
          "When no broker is connected, or for a market without a live integration yet, you can enter Spot, CE Premium, and PE Premium manually — the same calculation engine runs on either source.",
          "LYNX ONE does not operate its own market data feed and does not independently verify a broker's data against any other source. Data accuracy and timeliness are the responsibility of the connected broker.",
          "Every calculated result shows its Data Source (Live or Manual Entry) and the exact time it was last calculated, so you always know what a number is based on.",
        ],
      },
    ],
  },
  {
    id: "compliance-notice",
    title: "Compliance Notice",
    icon: ShieldCheck,
    sections: [
      {
        paragraphs: [
          "LYNX ONE is a mathematical calculation tool. It is not a SEBI-registered Investment Adviser, Research Analyst, or stock broker, and it does not provide personalized investment advice.",
          "LYNX ONE does not execute, place, or route trades of any kind — it only calculates and displays values based on data you supply or connect.",
          "Nothing displayed in LYNX ONE — including Calculated Levels, Calculated Premiums, or any Calculation Breakdown — is a buy or sell recommendation, and none of it should be treated as one.",
          "Before making any investment decision, consult a SEBI-registered financial adviser or other qualified professional.",
        ],
      },
    ],
  },
  {
    id: "contact-support",
    title: "Contact Support",
    icon: LifeBuoy,
    sections: [
      {
        paragraphs: [
          "For questions, feedback, or issues with LYNX ONE, use the support contact configured for your installation.",
          "Support contact details have not been configured yet for this deployment.",
        ],
      },
    ],
  },
  {
    id: "version",
    title: "Version",
    icon: Tag,
    sections: [
      {
        paragraphs: [
          "LYNX ONE — Version 1.0.0",
          "A mathematical market calculator, built for transparency: every displayed value traces back to a documented formula and a visible Calculation Breakdown.",
          "Made with ❤️ in India.",
        ],
      },
    ],
  },
];

export function getLegalPage(id: string): LegalPage | undefined {
  return LEGAL_PAGES.find((page) => page.id === id);
}
