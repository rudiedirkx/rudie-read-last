(function() {

	if ( !window.rudieLastReadConfig ) {
		console.error('Missing "rudieLastReadConfig"...');
		return;
	}

	var cfg = window.rudieLastReadConfig;

	/**
	cfg = {
		storeURL: '//example.com/store/',
		name: 'youtube',
		store: 'mine',

		// OPTIONAL //
		redundancy: 4, // default = 4

		// OPTIONAL //
		headerSelector: '.feed-header',
		appendButtonBefore: true, // true = first, false = last (default), <selector> = before that

		listSelector: '.individual-feed[data-feed-name="subscriptions"] #browse-items-primary',
		addListClass: 'rudie-read-it-list', // OPTIONAL, this is default
		addPageBreakClass: 'rudie-read-it-page-break', // OPTIONAL, this is default
		itemSelector: '.feed-item-container',
		idItemSelector: '[data-context-item-id]', // OPTIONAL, uses itemSelector by default
		idAttribute: 'data-context-item-id',
		subtree: false, // whether to listen for new nodes all the way down inside the listSelector

		// OPTIONAL //
		menuSelector: '.yt-uix-button-menu',
		menuHTML: '<ul><li class="rudie-read-it-menu-item" role="menuitem"><span class="yt-uix-button-menu-item">Mark this & older as READ</span></li></ul>', // Only the first element matching `.rudie-read-it-menu-item` will be used
		menuItemPosition: 0, // 0 is first, 1 is second etc -- if omitted, will add to the end

		// Events
		on: {
			init: Function, // AFTER init (after menu & mark)
			button: Function, // AFTER adding the read-all button
			menu: Function, // AFTER adding menu items
			mark: Function, // AFTER marking items as read
			listen: Function, // when the site loads more items
			menuClick: Function, // AFTER handing menu item click (after sending save)
			save: Function, // when receiving save response
		},
	};
	/**/

	// Check required config
	var fail = [];
	(['name', 'store', 'listSelector', 'itemSelector', 'idAttribute']).forEach(function(name) {
		if ( !(name in cfg) ) {
			fail.push('Config "' + name + '" is required.');
		}
	});
	if ( cfg.menuSelector && !cfg.menuHTML ) {
		fail.push('If you set a "menuSelector", you must set "menuHTML".');
	}

	if ( fail.length ) {
		alert('Invalid RUDIE-LAST-READ config:\n\n* ' + fail.join('\n* '));
		return;
	}

	// Append optional config
	cfg.active || (cfg.active = function() {
		var el = document.querySelector(this.listSelector);
		return el && (el.offsetHeight || el.offsetWidth);
	});
	cfg.redundancy || (cfg.redundancy = 4);
	cfg.addListClass == null && (cfg.addListClass = 'rudie-read-it-list');
	cfg.addPageBreakClass == null && (cfg.addPageBreakClass = 'rudie-read-it-page-break');

	cfg.storeQuery = 'store=' + encodeURIComponent(cfg.store);

	// Events
	cfg.on || (cfg.on = {});

	_init();

	function _init() {
console.debug('_init');
		if ( !cfg.active() ) return;

		_button();
		_listen();
		_mark();

		// Expose some?
		cfg.save = _save;

		_invoke('init');
	}

	function _ancestor(el, sel) {
		while ( el.parentNode && el != document.documentElement ) {
			el = el.parentNode;
			if ( el.matches(sel) ) {
				return el;
			}
		}
	}

	function _ajax(url, method, callback, data) {
		var xhr = new XMLHttpRequest;
		xhr.open(method, url, true);
		xhr.onload = function(e) {
			var rsp = this.responseText.substr(this.getResponseHeader('X-anti-hijack'));
			try {
				rsp = JSON.parse(rsp);
			}
			catch (ex) {
				return console.error('JSON error from Objective!', ex.message, rsp);
			}
			callback.call(this, rsp, e);
		};
		data && xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		xhr.send(data);
	}

	function _invoke(event, arg2) {
		if (cfg.on[event]) {
			cfg.on[event] instanceof Array || (cfg.on[event] = [cfg.on[event]]);

			cfg.on[event].forEach(function(handler) {
				handler(cfg, arg2);
			});
		}
	}

	function _get() {
console.debug('_get');
		_ajax(cfg.storeURL + '?' + cfg.storeQuery + '&get=' + encodeURIComponent(cfg.name) + '.lastread', 'get', function(rsp, e) {
			if ( rsp.error || !rsp.exists ) {
				return;
			}

			var itemSelector = cfg.idItemSelector || cfg.itemSelector;
			var selector = rsp.value.map(function(id) {
				return itemSelector + '[' + cfg.idAttribute + '="' + id + '"]';
			}).join(', ');

			var items = [].slice.call(document.querySelectorAll(selector));
			items.forEach(function(item, i) {
				if ( cfg.idItemSelector ) {
					item = items[i] = _ancestor(item, cfg.itemSelector);
				}
				item.classList.add('rudie-read-it');
			});

			_invoke('mark', {
				rsp: rsp.value,
				items: items,
			});
		});
	}

	function _mark() {
console.debug('_mark');
		_get();
		_menu();
	}

	function _menu() {
console.debug('_menu');
		if ( !cfg.menuSelector ) return;

		[].forEach.call(document.querySelectorAll(cfg.menuSelector), function(menu) {
			if ( menu.classList.contains('rudie-read-it-menu-items-added') ) return;
			menu.classList.add('rudie-read-it-menu-items-added');

			var frag = document.createElement('div');
			frag.innerHTML = cfg.menuHTML;
			var menuItem = frag.querySelector('.rudie-read-it-menu-item');
			menuItem.onclick = function(e) {
				e.preventDefault();

				var item = _ancestor(this, cfg.itemSelector);
				_save(item);

				e.self = this;
				_invoke('menuClick', e);
			};

			var items = menu.children;
			if ( cfg.menuItemPosition == null || cfg.menuItemPosition >= items.length ) {
				menu.appendChild(menuItem);
			}
			else {
				menu.insertBefore(menuItem, items[cfg.menuItemPosition]);
			}

			_invoke('menu', menu);
		});
	}

	function _save(lastReadItem, callback) {
console.debug('_save');
		var items = [].slice.call(cfg._list.querySelectorAll(cfg.itemSelector));
		lastReadItem || (lastReadItem = items[0]);

		[].forEach.call(document.querySelectorAll('.rudie-read-it'), function(el) {
			el.classList.remove('rudie-read-it');
		});

		var thisIndex = items.indexOf(lastReadItem);
		var readItems = items.slice(thisIndex, thisIndex + cfg.redundancy);
		var lastRead = readItems.map(function(item) {
			item.classList.add('rudie-read-it');
			if ( cfg.idItemSelector ) {
				item = item.querySelector(cfg.idItemSelector);
			}
			return item.getAttribute(cfg.idAttribute);
		});

		var button = document.querySelector('.rudie-read-it-button');
		button && button.classList.add('loading');

		console.time('SAVED LAST READ');
		_ajax(cfg.storeURL + '?' + cfg.storeQuery, 'post', function(rsp, e) {
			console.timeEnd('SAVED LAST READ');
			console.debug('SAVED LAST READ', rsp);

			button && button.classList.remove('loading');

			_invoke('save', {
				rsp: rsp.value,
				items: readItems,
			});
			callback && callback(cfg, readItems);
		}, 'put=' + cfg.name + '.lastread&value=' + encodeURIComponent(JSON.stringify(lastRead)));
	}

	function _button() {
console.debug('_button');
		if ( !cfg.headerSelector ) return;

		var header = document.querySelector(cfg.headerSelector);
		var button = document.createElement('button');
		button.textContent = 'Mark all READ';
		button.className = 'rudie-read-it-button';
		button.onclick = function() {
			_save();
			this.blur();
		};

		if ( cfg.appendButtonBefore === true ) {
			header.insertBefore(button, header.firstElementChild);
		}
		else if ( typeof cfg.appendButtonBefore == 'string' ) {
			header.insertBefore(button, header.querySelector(cfg.appendButtonBefore));
		}
		else {
			header.appendChild(button);
		}

		cfg._button = button;
		_invoke('button', button);
	}

	function _listen() {
console.debug('_listen');
		cfg._list = document.querySelector(cfg.listSelector);
		var mo = new MutationObserver(function(muts) {
			var match = false;
			for ( var j=0; j<muts.length; j++ ) {
				var mut = muts[j];
				for ( var i=0; i<mut.addedNodes.length; i++ ) {
					var node = mut.addedNodes[i];
					if ( node.matches(cfg.itemSelector) || node.querySelector(cfg.itemSelector) ) {
						match = mut.addedNodes;
						break;
					}
				}
			}

			_invoke('listen', match);

			if ( match ) {
				_breakPage();

				// Wait a while, until the host is definitely done painting
				setTimeout(_mark, 1);
			}
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
			items[items.length-1].classList.add(cfg.addPageBreakClass);
		}
	}

})();
