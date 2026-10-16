// Extraemos el JWT de la URL ANTES de que OHIF React Router lo limpie
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');
if (urlToken) {
  sessionStorage.setItem('mini_pacs_token', urlToken);
}

// OHIF obtiene las cabeceras DICOMweb desde su userAuthenticationService; la
// propiedad `headers` devuelta por onConfiguration no se aplica a esas llamadas.
// Añadimos el JWT a los XHR del proxy antes de enviarlos.
const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function (method, url, ...args) {
  try {
    this._miniPacsDicomWebRequest = new URL(url, window.location.href).pathname.startsWith(
      '/api/dicom-web/'
    );
  } catch {
    this._miniPacsDicomWebRequest = false;
  }

  return originalXhrOpen.call(this, method, url, ...args);
};

XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
  if (this._miniPacsDicomWebRequest && name.toLowerCase() === 'authorization') {
    const token = sessionStorage.getItem('mini_pacs_token');
    if (token) {
      value = `Bearer ${token}`;
    }
    this._miniPacsAuthorizationSet = true;
  }

  return originalSetRequestHeader.call(this, name, value);
};

XMLHttpRequest.prototype.send = function (...args) {
  if (this._miniPacsDicomWebRequest && !this._miniPacsAuthorizationSet) {
    const token = sessionStorage.getItem('mini_pacs_token');
    if (token) {
      originalSetRequestHeader.call(this, 'Authorization', `Bearer ${token}`);
      this._miniPacsAuthorizationSet = true;
    }
  }

  return originalXhrSend.apply(this, args);
};

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
