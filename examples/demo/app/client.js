import { hydrate } from './liteon.js';
import { App, router } from './app.js';
import { effect } from './liteon.js';

// Establish the current route before hydrating so router.view resolves.
router.start();

// Reuse the server-rendered DOM; attach listeners and reactive bindings.
hydrate(App(), document.getElementById('app'));

// Keep the tab title in sync on client-side navigation.
effect(() => {
  const route = router.current.value?.route;
  if (route?.title) document.title = route.title;
});
