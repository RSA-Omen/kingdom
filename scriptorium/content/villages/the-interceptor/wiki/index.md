# The Interceptor

A narrow process that sits on the Pronto URL path and routes implied-link URLs to NextCloud, instead of letting them die at Pronto's own resolver.

It predates [[bender]] and is not replaced by it. Bender drives Pronto's UI by keystroke; the Interceptor only handles this one specific URL-routing case.

See [[the-interceptor/flow]] for the routing flow and [[the-interceptor/integrations]] for what it connects to.
