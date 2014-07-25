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
		// storePassword: 'mine', // OPTIONAL, depends on Objective db

		// redundancy: 4, // OPTIONAL, default = 4

		headerSelector: '.feed-header',
		appendButtonBefore: true, // true = first, false = last (default), <selector> = before that

		listSelector: '.individual-feed[data-feed-name="subscriptions"] #browse-items-primary',
		itemSelector: '.feed-item-container',
		// idItemSelector: '[data-context-item-id]', // OPTIONAL, use itemSelector by default
		idAttribute: 'data-context-item-id',

		// OPTIONAL //
		menuSelector: '.yt-uix-button-menu',
		menuHTML: '<ul><li class="rudie-read-it-menu-item" role="menuitem"><span class="yt-uix-button-menu-item">Mark this & older as READ</span></li></ul>', // Only the first element matching `.rudie-read-it-menu-item` will be used
		onMenuClick: function(e) { // OPTIONAL, executed last, inside the event callback
			// Click the body to hide the menu popup
			document.body.click();
		},
	};
	/**/

	// Check required config
	var fail = [];
	(['name', 'store', 'headerSelector', 'appendButtonBefore', 'listSelector', 'itemSelector', 'idAttribute']).forEach(function(name) {
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
		return !!document.querySelector(this.listSelector);
	});
	cfg.redundancy || (cfg.redundancy = 4);

	cfg.storeQuery = 'store=' + encodeURIComponent(cfg.store);
	cfg.storePassword && (cfg.storeQuery += '&password='+ encodeURIComponent(cfg.storePassword));
	cfg.fullItemSelector = cfg.listSelector + ' ' + cfg.itemSelector;

	_init();

	function _init() {
console.debug('_init');
		if ( !cfg.active() ) return;

		_button();
		_listen();
		_mark();
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
			var rsp = this.responseText;
			try { rsp = JSON.parse(rsp); } catch (ex) {}
			callback.call(this, rsp, e);
		};
		data && xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		xhr.send(data);
	}

	function _get() {
console.debug('_get');
		// debug //
		try {
		// debug //

		_ajax(cfg.storeURL + '?' + cfg.storeQuery + '&get=' + encodeURIComponent(cfg.name) + '.lastread', 'get', function(rsp, e) {
			if ( rsp.error || !rsp.exists ) {
				return;
			}

			var itemSelector = cfg.idItemSelector || cfg.itemSelector;
			var selector = rsp.value.map(function(id) {
				return cfg.listSelector + ' ' + itemSelector + '[' + cfg.idAttribute + '="' + id + '"]';
			}).join(', ');
			var items = document.querySelectorAll(selector);
			[].forEach.call(items, function(item) {
				if ( cfg.idItemSelector ) {
					item = _ancestor(item, cfg.itemSelector);
				}
				item.classList.add('rudie-read-it');
			});
		});

		// debug //
		} catch (ex) {
			console.log(ex);
		}
		// debug //
	}

	function _mark() {
console.debug('_mark');
		_get();
		_menu();
	}

	function _menu() {
console.debug('_menu');
		if ( !cfg.menuSelector ) return;

		[].forEach.call(document.querySelectorAll(cfg.fullItemSelector + ' ' + cfg.menuSelector), function(menu) {
			if ( menu.classList.contains('rudie-read-it-menu-items-added') ) return;
			menu.classList.add('rudie-read-it-menu-items-added');

			var frag = document.createElement('div');
			frag.innerHTML = cfg.menuHTML;
			var menuItem = frag.querySelector('.rudie-read-it-menu-item');
			menuItem.onclick = function(e) {
				e.preventDefault();
				e.stopPropagation();

				var item = _ancestor(this, cfg.itemSelector);
				_save(item);

				cfg.onMenuClick && cfg.onMenuClick.call(this, e);
			};
			menu.appendChild(menuItem);
		});
	}

	function _save(lastReadItem) {
console.debug('_save');
		var items = [].slice.call(document.querySelectorAll(cfg.fullItemSelector));
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

		_ajax(cfg.storeURL + '?' + cfg.storeQuery, 'post', function(rsp, e) {
			console.log('SAVED LAST READ', rsp);
		}, 'put=' + cfg.name + '.lastread&value=' + encodeURIComponent(JSON.stringify(lastRead)));
	}

	function _button() {
console.debug('_button');
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
	}

	function _listen() {
console.debug('_listen');
		var list = document.querySelector(cfg.listSelector);
		var mo = new MutationObserver(function(muts) {
			if ( muts[0].addedNodes[0].matches(cfg.itemSelector) ) {
				setTimeout(_mark, 100);
			}
		});
		mo.observe(list, {childList: true});
	}

})();
