Rudie-read-last
====

A script (bookmarklet-able) to keep track of your last read X (tweets, youtube videos,
blog posts etc) in a list.

How it works
----

Set up the config and include the JS file in a page with a list (Twitter home, Youtube
subscriptions etc). No styling is included, so add your own somehow. The following CSS
selectors are relevant:

* `.rudie-read-it` for read feed items
* `.rudie-read-it-button` for the Mark All button ("Mark all READ")
* `.rudie-read-it-menu-item` for the Mark One menu item

The data
----

Data is stored in your own [object store](https://github.com/rudiedirkx/Objective) on
your own server.
