(function() {

	if ( !window.rudieLastReadConfig ) {
		console.error('Missing "rudieLastReadConfig"...');
		return;
	}

	var cfg = window.rudieLastReadConfig;

	/**
	cfg = {
		storeURL: '//store.example.com/index.php',
		store: 'mine',

		listSelector: 'ul.content',
		itemSelector: 'ul.content li',
		idItemSelector: 'ul.content li h3', // OPTIONAL, default is `itemSelector`
		idAttribute: 'data-id',
		idAttributeRegex: /^([a-z]+)/, // OPTIONAL
		subtree: false, // OPTIONAL

		addListClass: 'rudie-read-it-list', // OPTIONAL
		addPageBreakClass: 'rudie-read-it-page-break', // OPTIONAL

		// OPTIONAL
		menuPocket: {
			appendTo: 'ul.content ul.menu', // only add if different from `itemSelector`
			html: '<ul><li class="rudie-read-it-menu-pocket"></li></ul>',
		},

		trackers: [
			{
				name: 'lastread.seen',
				className: 'seen',
				redundancy: 4,
				appendTo: 'ul.content li', // Menu item, because `html`
				html: '<button class="rudie-read-it-menu-item seen">..</button>',
				position: 999, // OPTIONAL, 0 = first, 1 = second, etc, 999 = last
				all: {
					appendTo: 'h1',
					html: '<button class="rudie-read-it-all-menu-item">Mark ALL read</button>',
					before: '.some-selector',
				},
			},
			{
				name: 'lastread.hilite',
				className: 'hilited',
				redundancy: 0,
				appendTo: 'ul.content li', // Clickable, because `notParents`
				notParents: 'a, button',
			},
		]

		// Events
		on: {
			init: Function(cfg),   // AFTER init (after menu & mark)
			mark: Function(cfg, {tracker, rsp, items}),   // AFTER marking items as read
			menu: Function(cfg, {tracker, menu[, menuItem]}),   // AFTER adding 1 menu item on 1 item
			menus: Function(cfg, {item, menuPocket}),   // AFTER adding all menu items on 1 item
			menuClick: Function(cfg, {tracker, item}),   // AFTER handing menu item click (after sending save)
			save: Function(cfg, {tracker, rsp, items}),   // when receiving save response
			button: Function(cfg, {tracker, button}),   // AFTER adding a read-all button
			buttons: Function(cfg, {buttons}),   // AFTER adding all read-all buttons
			listen: Function(cfg, {match}),   // when the site loads more items
			load: Function(cfg, {tracker}),   // BEFORE saving
			unload: Function(cfg, {tracker}),   // AFTER having saved and callbacked
		},
	};
	/**/

	// Check required config
	var fail = [];
	(['storeURL', 'listSelector', 'itemSelector', 'idAttribute', 'trackers']).forEach(function(name) {
		if ( cfg[name] == null ) {
			fail.push('Config "' + name + '" is required.');
		}
	});

	if ( !cfg.store && cfg.storeURL.indexOf('store=') == -1 ) {
		fail.push('Config "store" is required, separately or in "storeURL".');
	}

	cfg.trackers && cfg.trackers.forEach(function(tracker) {
		(['name', 'className', 'appendTo', 'redundancy']).forEach(function(name) {
			if ( tracker[name] == null ) {
				fail.push('Config "tracker[' + name + ']" is required.');
			}
		});

		if ( tracker.redundancy == 0 && tracker.all ) {
			fail.push("Per-item trackers can't have an 'all' button.");
		}
	});

	if ( fail.length ) {
		alert('Invalid RUDIE-LAST-READ config:\n\n* ' + fail.join('\n* '));
		return;
	}

	// Append optional config
	cfg.active || (cfg.active = function() {
		var el = document.querySelector(this.listSelector);
_debug('active', el, el && el.offsetHeight, el && el.offsetWidth);
		return el && (el.offsetHeight || el.offsetWidth);
	});
	cfg.redundancy || (cfg.redundancy = 4);
	cfg.addListClass == null && (cfg.addListClass = 'rudie-read-it-list');
	cfg.addPageBreakClass == null && (cfg.addPageBreakClass = 'rudie-read-it-page-break');

	cfg.storeURLWithStore = cfg.storeURL.indexOf('store=') < 0 ? cfg.storeURL + 'store=' + encodeURIComponent(cfg.store) + '&' : cfg.storeURL + '&';

	cfg.CACHE_TTL_MINUTES || (cfg.CACHE_TTL_MINUTES = 5);
	cfg.cache || (cfg.cache = {});

	// Events
	cfg.on || (cfg.on = {});

	_init();

	function _debug(...args) {
		cfg.debug && console.debug(...args);
	}

	function _init() {
_debug('_init...');
		if ( !cfg.active() ) return;

		_allButtons();
		_listen();
		_mark();

		// Expose some?
		cfg.save = _save;

		_invoke('init');
	}

	function _closest(el, sel) {
		while ( el.parentNode && el != document.documentElement ) {
			if ( el.matches(sel) ) {
				return el;
			}
			el = el.parentNode;
		}
	}

	// function _data(data) {
	// 	var query = [];
	// 	for ( var name in data ) {
	// 		var value = data[name];
	// 		query.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
	// 	}
	// 	return query.join('&');
	// }

	function _ajax(method, url, data) {
		return new Promise(resolve => {
			var xhr = new XMLHttpRequest;
			xhr.open(method, url, true);
			xhr.onload = function(e) {
				var rsp = this.responseText.substr(this.getResponseHeader('X-anti-hijack'));
				rsp = JSON.parse(rsp);
				resolve(rsp);
			};
			data && xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
			xhr.send(data);
		});
	}

	function _invoke(event, arg2) {
		if (cfg.on[event]) {
			cfg.on[event] instanceof Array || (cfg.on[event] = [cfg.on[event]]);

			cfg.on[event].forEach(function(handler) {
				handler(cfg, arg2);
			});
		}
	}

	function _mark() {
_debug('_mark...');
		// Get data, across all items, per tracker
		cfg.trackers.forEach(function(tracker) {
			_get(tracker);
		});

		// For every item, create a menu pocket, and per tracker create menu items
		[].forEach.call(document.querySelectorAll(cfg.itemSelector), function(item) {
			if ( item.classList.contains('rudie-read-it-menu-items-added') ) return;
			item.classList.add('rudie-read-it-menu-items-added');

			// Create a menu pocket
			var menuPocket;
			if ( cfg.menuPocket ) {
				var appendTo = cfg.menuPocket.appendTo ? item.querySelector(cfg.menuPocket.appendTo) : item;
				var frag = document.createElement('div');
				frag.innerHTML = cfg.menuPocket.html;
				menuPocket = frag.querySelector('.rudie-read-it-menu-pocket');
				appendTo.appendChild(menuPocket);
			}

			// Create 1 menu item per tracker
			cfg.trackers.forEach(function(tracker) {
				if ( !tracker.appendTo ) return;

				var menu = item.matches(tracker.appendTo) ? item : item.querySelector(tracker.appendTo);
				_menu(tracker, menu);
			});

			_invoke('menus', {
				item: item,
				menuPocket: menuPocket,
			});
		});
	}

	function _get(tracker) {
		if ( cfg.cache[tracker.name] && cfg.cache[tracker.name].time > Date.now() - cfg.CACHE_TTL_MINUTES * 60 * 1000 ) {
_debug('_get [' + tracker.name + '] CACHED...');
			const rsp = cfg.cache[tracker.name].value;
			// _debug('GOT LAST READ FROM CACHE', rsp);
			_got(tracker, rsp);
		}
		else {
_debug('_get [' + tracker.name + '] FRESH...');
			const url = cfg.storeURLWithStore + 'get=' + encodeURIComponent(tracker.name);
			_ajax('GET', url).then(rsp => {
				// _debug('GOT FRESJ LAST READ', rsp);
				cfg.cache[tracker.name] = {
					time: Date.now(),
					value: rsp,
				};
				_got(tracker, rsp);
			});
		}
	}

	function _got(tracker, rsp) {
		if ( rsp.error || rsp.exists === false || !rsp.value || rsp.value.length == undefined ) {
			return console.warn('_got invalid response', rsp);
		}

		var itemSelector = cfg.idItemSelector || cfg.itemSelector;
		var items;
		if ( cfg.idAttribute == '$text' ) {
			items = [].filter.call(document.querySelectorAll(itemSelector), function(el) {
				return rsp.value.indexOf(el.textContent.trim().toLowerCase()) >= 0;
			});
		}
		else {
			var operator = cfg.idAttributeRegex ? '*=' : '=';
			var selector = rsp.value.map(function(id) {
				return itemSelector.split(/,\s+/g). map(function(subSel) {
					return subSel + '[' + cfg.idAttribute + operator + '"' + id + '"]';
				}).join(', ');
			}).join(', ');
			items = selector ? [].slice.call(document.querySelectorAll(selector)) : [];
		}

		items.forEach(function(item, i) {
			if ( cfg.idItemSelector ) {
				item = items[i] = _closest(item, cfg.itemSelector);
			}
			item.classList.add('rudie-read-it');
			item.classList.add(tracker.className);
		});

		_invoke('mark', {
			tracker: tracker,
			rsp: rsp.value,
			items: items,
		});
	}

	function _menu(tracker, menu) {
		function __save(item) {
			_save(tracker, item);
			_invoke('menuClick', {
				tracker: tracker,
				item: item,
			});
		}

		var menuItem;
		if ( tracker.html ) {
			var frag = document.createElement('div');
			frag.innerHTML = tracker.html;
			menuItem = frag.querySelector('.rudie-read-it-menu-item');
			menuItem.onclick = function(e) {
				e.preventDefault();

				__save(_closest(this, cfg.itemSelector));
			};

			var items = menu.children;
			if ( tracker.position == null || tracker.position >= items.length ) {
				menu.appendChild(menuItem);
			}
			else {
				menu.insertBefore(menuItem, items[tracker.position]);
			}
		}
		else {
			menu.addEventListener('click', function(e) {
				if ( !_closest(e.target, tracker.notParents) ) {
					e.preventDefault();
					__save(_closest(this, cfg.itemSelector));
				}
			});
		}

		_invoke('menu', {
			tracker: tracker,
			menu: menu,
			menuItem: menuItem,
		});
	}

	function _save(tracker, lastReadItem, callback) {
_debug('_save [' + tracker.name + ']...');
		_invoke('load', {
			tracker: tracker,
		});

		var items = [].slice.call(cfg._list.querySelectorAll(cfg.itemSelector));
		lastReadItem || (lastReadItem = items[0]);

		function mapper(item) {
			item.classList.add('rudie-read-it');
			item.classList.toggle(tracker.className);
			if ( cfg.idItemSelector ) {
				var subitem = item.querySelector(cfg.idItemSelector);
				if ( !subitem ) {
					return;
				}
				item = subitem;
			}
			var attr = cfg.idAttribute == '$text' ? item.textContent.trim().toLowerCase() : item.getAttribute(cfg.idAttribute);
			if ( cfg.idAttributeRegex ) {
				var m = attr.match(cfg.idAttributeRegex);
				if ( m && m[1] ) {
					attr = m[1];
				}
			}
			return attr;
		}

		// Overwrite previous list with new list
		if ( tracker.redundancy > 0 ) {
			[].forEach.call(document.querySelectorAll('.rudie-read-it.' + tracker.className), function(el) {
				el.classList.remove(tracker.className);
			});

			var thisIndex = items.indexOf(lastReadItem);
			var readItems = items.slice(thisIndex, thisIndex + tracker.redundancy);
			var lastRead = readItems.map(mapper).filter(x => x != null);
			var method = 'put';
		}

		// Add/remove 1 item
		else {
			var readItems = [lastReadItem];
			var lastRead = mapper(lastReadItem);
			var method = lastReadItem.classList.contains(tracker.className) ? 'push' : 'pull';
		}

_debug('save:', method, lastRead);

		console.time('SAVED LAST READ');
		const data = method + '=' + encodeURIComponent(tracker.name) + '&value=' + encodeURIComponent(JSON.stringify(lastRead));
		_ajax('POST', cfg.storeURLWithStore, data).then(function(rsp) {
			cfg.cache[tracker.name] = {
				time: Date.now(),
				value: rsp,
			};

			console.timeEnd('SAVED LAST READ');
			// _debug('SAVED LAST READ', rsp);

			_invoke('save', {
				tracker: tracker,
				rsp: rsp.value,
				items: readItems,
			});

			callback && callback(cfg, readItems);

			_invoke('unload', {
				tracker: tracker,
			});
		});
	}

	function _allButtons() {
_debug('_allButton...');
		cfg._buttons = cfg.trackers.map(_allButton);
		_invoke('buttons', {
			buttons: cfg._buttons,
		});
	}

	function _allButton(tracker) {
		if ( !tracker.all ) return false;
_debug('_allButton [' + tracker.name + ']...');

		var header = document.querySelector(tracker.all.appendTo);

		var frag = document.createElement('div');
		frag.innerHTML = tracker.all.html;

		var button = frag.querySelector('.rudie-read-it-all-menu-item');
		button.onclick = function(e) {
			e.preventDefault();
			_save(tracker, null);
			this.blur();
		};

		if ( tracker.all.before === true ) {
			header.insertBefore(button, header.firstElementChild);
		}
		else if ( typeof tracker.all.before == 'string' ) {
			header.insertBefore(button, header.querySelector(tracker.all.before));
		}
		else {
			header.appendChild(button);
		}

		_invoke('button', {
			tracker: tracker,
			button: button,
		});
		return button;
	}

	function _listen() {
_debug('_listen...');
		cfg._list = document.querySelector(cfg.listSelector);
		var matches = [];
		var update = function() {
			if ( !matches.length ) return;

			var e = {
				match: matches,
				mark: true,
			};
			_invoke('listen', e);

			matches.length = 0;

			if ( e.mark ) {
				_breakPage();

				// Wait a while, until the host is definitely done painting
				setTimeout(_mark, 1);
			}
		};
		var mo = new MutationObserver(function(muts) {
			var match = null;
			for ( var j=0; j<muts.length; j++ ) {
				var mut = muts[j];
				for ( var i=0; i<mut.addedNodes.length; i++ ) {
					var node = mut.addedNodes[i];
					if ( node.matches && (node.matches(cfg.itemSelector) || node.querySelector(cfg.itemSelector)) ) {
						match = mut.addedNodes;
						break;
					}
				}
			}

			if ( match ) {
				matches = matches.concat(match);
			}

			update();
		});
		mo.observe(cfg._list, {childList: true, subtree: !!cfg.subtree});

		if ( cfg.addListClass ) {
			cfg._list.classList.add(cfg.addListClass);
		}

		_breakPage();
	}

	function _breakPage() {
		if ( cfg.addPageBreakClass ) {
			var items = [].slice.call(cfg._list.querySelectorAll(cfg.itemSelector));
			if (items.length) {
				items[items.length-1].classList.add(cfg.addPageBreakClass);
			}
		}
	}

})();
