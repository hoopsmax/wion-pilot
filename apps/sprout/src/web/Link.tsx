import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './navigation.ts';

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** A normal link (so it works with a middle click), but in-app clicks skip the page reload. */
export function Link({ href, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const opensElsewhere = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
    if (event.defaultPrevented || opensElsewhere) return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handleClick} {...rest} />;
}
