-- Orthanc Lua Script: Webhook Notification for New Studies
-- This script notifies the MiniPACS backend when a new study is received
-- via DICOM C-STORE from the Mindray DigiEye 330

-- Configuration (injected via environment variables or hardcoded for Docker)
local BACKEND_WEBHOOK_URL = os.getenv("BACKEND_WEBHOOK_URL") or "http://app:3000/api/orthanc/webhook"
local BACKEND_SECRET = os.getenv("BACKEND_WEBHOOK_SECRET") or "pacs-webhook-secret-2026"

-- Called when a new instance is stored
function OnStoredInstance(instanceId, tags, metadata, origin)
  -- Only process instances received via DICOM protocol (C-STORE)
  if origin ~= nil and origin.Origin ~= "DicomProtocol" then
    return
  end

  -- Get study-level information
  local instance = ParseJson(RestApiGet("/instances/" .. instanceId))
  local seriesId = instance.ParentSeries
  local studyId = instance.ParentStudy

  -- Check if this is the first instance of a new study
  -- (to avoid sending multiple webhooks for the same study)
  local series = ParseJson(RestApiGet("/series/" .. seriesId))
  local instanceCount = #series.Instances

  -- Only notify on first instance of each series
  if instanceCount ~= 1 then
    return
  end

  -- Get study metadata
  local study = ParseJson(RestApiGet("/studies/" .. studyId))
  local studyTags = study.MainDicomTags or {}
  local patientTags = {}

  -- Get patient information
  local patientId = study.ParentPatient
  if patientId then
    local patient = ParseJson(RestApiGet("/patients/" .. patientId))
    patientTags = patient.MainDicomTags or {}
  end

  -- Build webhook payload
  local payload = {
    event = "new_study",
    timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
    orthancStudyId = studyId,
    orthancSeriesId = seriesId,
    orthancInstanceId = instanceId,
    studyInstanceUid = studyTags.StudyInstanceUID or "",
    accessionNumber = studyTags.AccessionNumber or "",
    studyDescription = studyTags.StudyDescription or "",
    studyDate = studyTags.StudyDate or "",
    studyTime = studyTags.StudyTime or "",
    patientId = patientTags.PatientID or "",
    patientName = patientTags.PatientName or "",
    patientSex = patientTags.PatientSex or "",
    patientBirthDate = patientTags.PatientBirthDate or "",
    modality = tags.Modality or "",
    institutionName = studyTags.InstitutionName or "",
    manufacturer = tags.Manufacturer or "",
    manufacturerModelName = tags.ManufacturerModelName or ""
  }

  -- Send webhook notification to backend
  local jsonPayload = DumpJson(payload)
  local headers = {
    ["Content-Type"] = "application/json",
    ["X-Webhook-Secret"] = BACKEND_SECRET
  }

  -- Async HTTP POST (non-blocking)
  local success, response = pcall(function()
    return HttpPost(BACKEND_WEBHOOK_URL, jsonPayload, headers)
  end)

  if success then
    print("[Webhook] Notified backend of new study: " .. (studyTags.AccessionNumber or studyId))
  else
    print("[Webhook] Failed to notify backend: " .. tostring(response))
  end
end

-- Called when Orthanc starts
function Initialize()
  print("========================================")
  print("MiniPACS Orthanc Webhook Script Loaded")
  print("Backend URL: " .. BACKEND_WEBHOOK_URL)
  print("========================================")
end
