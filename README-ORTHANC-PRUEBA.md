# Orthanc de prueba

Este archivo levanta un Orthanc separado usando la imagen oficial fijada
`orthancteam/orthanc:26.9.1`, el plugin DICOMweb compatible incluido en esa
imagen y un volumen **nuevo** (`pacs-orthanc-test-data`). No reutiliza ni borra
el volumen Orthanc de producción.

La configuración conserva el AET, usuario, contraseña, puertos, modalidades,
transcoding y webhook del PACS. Se omite deliberadamente la propiedad `Plugins`
de `orthanc.json`: la imagen oficial detecta `DicomWeb.Enable` y carga su plugin
desde la ruta correcta. No agregues un `command` que omita el entrypoint de la
imagen, porque este genera la configuración y activa los plugins.

## Usarlo en lugar del Orthanc de producción

Los puertos predeterminados son los mismos de producción (`4242` DICOM y `8042`
HTTP), y el contenedor publica el alias de red `orthanc` para que el backend
React existente siga usando `http://orthanc:8042`.

1. Confirma que el Mindray no esté enviando estudios. Desde la carpeta del
   proyecto, detén solo el Orthanc de producción:

   ```powershell
   docker compose stop orthanc
   docker ps -a --filter "name=pacs-orthanc"
   ```

2. Levanta el Orthanc de prueba con el mismo nombre de proyecto para que use la
   red Docker del PACS:

   ```powershell
   docker compose -p pacs-web-rayos-x -f docker-compose.orthanc-test.yml up -d
   docker logs -f pacs-orthanc-test
   ```

3. Envía primero **un estudio nuevo** desde el Mindray, al destino habitual:
   IP del servidor, puerto `4242`, AET `ORTHANC_PACS`. Comprueba el archivo en
   `/instances/{id}/file`, la metadata DICOMweb y OHIF antes de enviar varios.

4. Para finalizar y volver a producción, no uses `down -v`:

   ```powershell
   docker compose -p pacs-web-rayos-x -f docker-compose.orthanc-test.yml stop orthanc-test
   docker compose -p pacs-web-rayos-x -f docker-compose.orthanc-test.yml rm -f orthanc-test
   docker compose start orthanc
   ```

   El volumen `pacs-orthanc-test-data` queda conservado. Los estudios que entren
   durante la prueba no aparecerán en el volumen original de producción.

## Ejecutarlo en paralelo (sin ocupar los puertos de producción)

En PowerShell, antes de `up`, define puertos y alias distintos:

```powershell
$env:ORTHANC_TEST_DICOM_HOST_PORT = "4243"
$env:ORTHANC_TEST_HTTP_HOST_PORT = "8043"
$env:ORTHANC_TEST_NETWORK_ALIAS = "orthanc-test"
docker compose -p pacs-web-rayos-x-test -f docker-compose.orthanc-test.yml up -d
```

En modo paralelo, consulta la instancia de prueba en `http://localhost:8043`.
El alias `orthanc-test` evita que el backend del PACS cambie de destino.

## Credenciales y webhook

La contraseña se toma de `ORTHANC_PASS`; si no está definida, usa el valor por
defecto configurado para este PACS. El webhook usa `WEBHOOK_SECRET` y envía al
servicio `app` de la red Docker. Si se ejecuta sin el backend Mini PACS, el
webhook puede registrar un fallo de notificación, pero Orthanc seguirá
recibiendo y almacenando por C-STORE.

La imagen se fija a `26.9.1` para hacer reproducible la prueba. No cambies a
`:latest` ni borres el volumen de producción como parte de este procedimiento.
