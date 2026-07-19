type Props = {
  className?: string;
};

/**
 * Official LYNX ONE brand mark — locked asset, sourced directly from
 * /public/lynx-one-logo.png. Do not redraw, recolor, or regenerate it here;
 * this component only controls display size via className.
 */
export default function LynxMark({ className = "h-10 w-auto" }: Props) {
  // Next/Image's optimizer targets responsive raster delivery, which this
  // single fixed-size brand asset doesn't need.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/lynx-one-logo.png" alt="LYNX ONE" className={className} />;
}
