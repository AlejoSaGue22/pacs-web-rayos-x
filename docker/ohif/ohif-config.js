// Extraemos el JWT de la URL ANTES de que OHIF React Router lo limpie
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token');
if (urlToken) {
  sessionStorage.setItem('mini_pacs_token', urlToken);
}

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
        supportsFuzzyMatching: false,
        supportsWildcard: false,
        staticWado: false,
        singlepart: 'bulkdata,video,pdf',
        onConfiguration: (dicomWebConfig, options) => {
          const token = sessionStorage.getItem('mini_pacs_token');
          if (token) {
            dicomWebConfig.headers = {
              ...dicomWebConfig.headers,
              Authorization: `Bearer ${token}`
            };
          }
          return dicomWebConfig;
        }
      },
    },
  ],
  // Ocultamos opciones internas innecesarias
  studyListFunctionsEnabled: false,
};
