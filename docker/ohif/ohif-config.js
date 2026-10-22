// Mini PACS: inyecta el JWT en las peticiones DICOMweb de OHIF.
// OHIF v3 usa fetch (dicomweb-client) y XHR según el caso, por eso se
// parchean AMBOS. Sin esto el backend responde 401
// {"error":"Token de autenticación requerido"} y el visor queda en loader.
(function () {
  function getToken() {
    try {
      var p = new URLSearchParams(window.location.search);
      var t = p.get('token') || p.get('access_token');
      if (t) {
        try { sessionStorage.setItem('mini_pacs_token', t); } catch (e) {}
        return t;
      }
    } catch (e) {}
    try {
      return (
        sessionStorage.getItem('mini_pacs_token') ||
        localStorage.getItem('mini_pacs_token') ||
        localStorage.getItem('pacs_token') ||
        null
      );
    } catch (e) {
      return null;
    }
  }

  function isDicomWebUrl(urlStr) {
    if (typeof urlStr !== 'string') return false;
    // Robusto ante URLs absolutas (http://IP:3000/...) y relativas.
    if (urlStr.indexOf('/api/dicom-web/') !== -1) return true;
    try {
      var u = new URL(urlStr, window.location.href);
      return u.pathname.indexOf('/api/dicom-web/') === 0;
    } catch (e) {
      return false;
    }
  }

  function withTokenQuery(urlStr, token) {
    try {
      var u = new URL(urlStr, window.location.href);
      if (!u.searchParams.get('token') && !u.searchParams.get('access_token')) {
        u.searchParams.set('token', token);
      }
      // Si la URL original era relativa, devolver relativa para no romper CORS/base.
      if (typeof urlStr === 'string' && urlStr.indexOf('http') !== 0 && urlStr.indexOf('//') !== 0) {
        return u.pathname + (u.search ? u.search : '') + (u.hash ? u.hash : '');
      }
      return u.toString();
    } catch (e) {
      return urlStr;
    }
  }

  // --- Parche XHR (cubría solo parte de OHIF) ---
  var originalXhrOpen = XMLHttpRequest.prototype.open;
  var originalXhrSend = XMLHttpRequest.prototype.send;
  var originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments, 2);
    try {
      this._miniPacsDicomWebRequest = isDicomWebUrl(url);
      // Respaldo ?token=: el backend lo acepta y lo elimina antes de Orthanc.
      if (this._miniPacsDicomWebRequest) {
        var tok = getToken();
        if (tok) url = withTokenQuery(url, tok);
      }
    } catch (e) {
      this._miniPacsDicomWebRequest = false;
    }
    this._miniPacsAuthorizationSet = false;
    return originalXhrOpen.call(this, method, url, args[0], args[1], args[2]);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this._miniPacsDicomWebRequest && String(name).toLowerCase() === 'authorization') {
      var token = getToken();
      if (token) value = 'Bearer ' + token;
      this._miniPacsAuthorizationSet = true;
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._miniPacsDicomWebRequest && !this._miniPacsAuthorizationSet) {
      var token = getToken();
      if (token) {
        try {
          originalSetRequestHeader.call(this, 'Authorization', 'Bearer ' + token);
        } catch (e) {}
        this._miniPacsAuthorizationSet = true;
      }
    }
    return originalXhrSend.apply(this, arguments);
  };

  // --- Parche fetch (el que faltaba: QIDO/WADO metadata de OHIF usan fetch) ---
  if (window.fetch) {
    var originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        var urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : null);
        if (urlStr && isDicomWebUrl(urlStr)) {
          var token = getToken();
          if (token) {
            var newUrl = withTokenQuery(urlStr, token);
            init = init || {};
            var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers ? input.headers : undefined));
            if (!headers.get('Authorization')) {
              headers.set('Authorization', 'Bearer ' + token);
            }
            init.headers = headers;
            if (typeof input === 'string') {
              return originalFetch(newUrl, init);
            }
            // input es Request: recrearlo con URL + headers inyectados
            var reqInit = {
              method: input.method,
              headers: headers,
              body: input.body,
              referrer: input.referrer,
              referrerPolicy: input.referrerPolicy,
              mode: input.mode,
              credentials: input.credentials,
              cache: input.cache,
              redirect: input.redirect,
              integrity: input.integrity,
              keepalive: input.keepalive,
              signal: input.signal,
            };
            for (var k in init) {
              if (init[k] !== undefined) reqInit[k] = init[k];
            }
            return originalFetch(new Request(newUrl, reqInit));
          }
        }
      } catch (e) {}
      return originalFetch(input, init);
    };
  }

  try {
    console.log('[MiniPACS] DICOMweb auth patch activo (fetch+XHR). Token presente:', !!getToken());
  } catch (e) {}
})();

window.config = {
  routerBasename: '/',
  extensions: [],
  modes: [],
  // Deshabilitar la lista de estudios interna de OHIF porque Mini PACS es el RIS principal
  showStudyList: false,
  // Ocultar mensaje de "Investigational Use Only" para no asustar al hospital
  showWarningMessageForTesting: false,
  investigationalUseDialog: { option: 'never' },
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,
  defaultDataSourceName: 'dicomweb',
  dataSources: [
    {
      friendlyName: 'Mini PACS DICOMweb Proxy',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        name: 'MiniPACS',
        // La URL debe ser dinámica para que si el médico se conecta desde la IP 192.168.x.x,
        // consulte al puerto 3000 de ESA MISMA IP, no a 'localhost'.
        wadoUriRoot: window.location.protocol + '//' + window.location.hostname + ':3000/api/dicom-web',
        qidoRoot: window.location.protocol + '//' + window.location.hostname + ':3000/api/dicom-web',
        wadoRoot: window.location.protocol + '//' + window.location.hostname + ':3000/api/dicom-web',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video,pdf',
      },
    },
  ],
  // Ocultamos opciones internas innecesarias
  studyListFunctionsEnabled: false,
};
