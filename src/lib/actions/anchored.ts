import { computePosition, offset, flip, shift, autoUpdate, type Placement } from '@floating-ui/dom';

export interface AnchoredOptions {
	/** The element to position against. May be undefined briefly until a bound ref resolves. */
	anchor: HTMLElement | undefined;
	/** Preferred placement (default 'bottom-start'). */
	placement?: Placement;
	/** Gap in px between anchor and floating element (default 6). */
	gutter?: number;
}

/**
 * Positions `node` relative to `options.anchor`, flipping when there's no room
 * and shifting to stay within the viewport with an 8px gutter. Uses a fixed
 * positioning strategy so the popover escapes any clipped/scrolled ancestor.
 */
export function anchored(node: HTMLElement, options: AnchoredOptions) {
	let opts = options;
	let cleanup: () => void = () => {};

	// Take the node out of flow immediately so it doesn't flash at its static
	// position for one frame before the async computePosition resolves.
	node.style.position = 'fixed';

	function reposition() {
		if (!opts.anchor) return;
		computePosition(opts.anchor, node, {
			strategy: 'fixed',
			placement: opts.placement ?? 'bottom-start',
			middleware: [offset(opts.gutter ?? 6), flip(), shift({ padding: 8 })],
		}).then(({ x, y }) => {
			Object.assign(node.style, { position: 'fixed', left: `${x}px`, top: `${y}px` });
		});
	}

	function start() {
		cleanup();
		cleanup = opts.anchor ? autoUpdate(opts.anchor, node, reposition) : () => {};
	}

	start();

	return {
		update(next: AnchoredOptions) {
			opts = next;
			start();
		},
		destroy() {
			cleanup();
		},
	};
}
