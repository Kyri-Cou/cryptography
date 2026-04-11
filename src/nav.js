// Nav dropdown behaviour: close open <details class="nav-group"> groups when
// the user clicks outside, and close sibling groups when one is opened.
// Kept tiny so every page can import it without ceremony.

const groups = () => document.querySelectorAll('.nav-group');

document.addEventListener('click', (e) => {
  for (const g of groups()) {
    if (!g.contains(e.target)) g.removeAttribute('open');
  }
});

for (const g of groups()) {
  g.addEventListener('toggle', () => {
    if (!g.open) return;
    for (const other of groups()) {
      if (other !== g) other.removeAttribute('open');
    }
  });
}
