// Leave time between batches for dragging, zooming and cancelling stale work.
export function renderLaneBatches(items, render, complete = () => {}, background = false, maxItems = 40) {
 let index = 0, frame;
 // Message tasks can yield after each LINK without a one-frame delay per road.
 // They also allow old objects to be removed when animation frames pause.
 const channel = background ? new MessageChannel() : null;
 const close = () => {channel?.port1.close();channel?.port2.close();};
 const schedule = () => {
  if (channel) channel.port2.postMessage(null);
  else frame = requestAnimationFrame(step);
 };
 const step = () => {
  const start = performance.now();
  let count = 0;
  while (index < items.length && count < maxItems && performance.now() - start < 5) {
   render(items[index++]);
   count++;
  }
  if (index < items.length) schedule();
  else {close();complete();}
 };
 if (channel) channel.port1.onmessage = step;
 schedule();
 return () => {if (frame !== undefined) cancelAnimationFrame(frame);close();};
}
