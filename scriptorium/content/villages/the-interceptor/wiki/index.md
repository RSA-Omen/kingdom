# The Interceptor

A small, single-purpose process that sits between **Pronto Xi** and **NextCloud**. When a user clicks the **Quick Links** button inside Pronto, Pronto generates a URL and sends the user toward it. The Interceptor catches that request, recognises whether the target should live in NextCloud, and relays the user there.

Everything that isn't a Quick Links destination passes through untouched to Pronto's normal URL handler.

The Interceptor predates [[bender]] and is not replaced by it. The two villages do different jobs:

- **The Interceptor** sits between Pronto and NextCloud — handles the narrow Quick Links routing case on the way through.
- **[[bender]]** drives Pronto's UI by keystroke for everything else.

Because the Interceptor only cares about Quick Links requests, it's the smallest production village in the kingdom. The whole story is the [[the-interceptor/flow]] page.
