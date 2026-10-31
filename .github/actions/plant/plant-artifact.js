#!/usr/bin/env node
// Uploads an artifact built with @actions/artifact internals so that the zip
// entry names can contain mid-path ".." components. download-artifact's
// bundled unzip-stream strips only LEADING dot components, so path.join()
// normalisation turns these into writes outside the extraction directory.
const fs = require('fs')
const path = require('path')

const A = '@actions/artifact'
const { createZipUploadStream } = require(`${A}/lib/internal/upload/zip`)
const { uploadZipToBlobStorage } = require(`${A}/lib/internal/upload/blob-upload`)
const { internalArtifactTwirpClient } = require(`${A}/lib/internal/shared/artifact-twirp-client`)
const { getBackendIdsFromToken } = require(`${A}/lib/internal/shared/util`)
const { StringValue } = require(`${A}/lib/generated`)

async function main() {
  const name = process.env.INPUT_NAME
  const workspace = process.env.GITHUB_WORKSPACE
  const baseInput = process.env.INPUT_EXTRACT_BASE || 'docs-build'
  const extractDir = path.isAbsolute(baseInput) ? baseInput : path.join(workspace, baseInput)
  const pairs = (process.env.INPUT_PAIRS || '').split(',').map(s => s.trim()).filter(Boolean)

  const spec = []
  for (const pair of pairs) {
    const [src, target] = pair.split('->').map(s => s.trim())
    const sourcePath = path.isAbsolute(src) ? src : path.join(workspace, src)
    const targetAbs = path.isAbsolute(target) ? target : path.join(workspace, target)
    // first component "x" is not a dot, so the extractor's sanitizer leaves it alone
    const destinationPath = 'x/' + path.relative(path.join(extractDir, 'x'), targetAbs)
    const resolved = path.join(extractDir, destinationPath)
    if (resolved !== targetAbs) throw new Error(`mismatch ${resolved} != ${targetAbs}`)
    console.log(`entry ${JSON.stringify(destinationPath)} -> ${resolved}`)
    spec.push({ sourcePath, destinationPath, stats: fs.lstatSync(sourcePath) })
  }

  const backendIds = getBackendIdsFromToken()
  const client = internalArtifactTwirpClient()
  const createResp = await client.CreateArtifact({
    workflowRunBackendId: backendIds.workflowRunBackendId,
    workflowJobRunBackendId: backendIds.workflowJobRunBackendId,
    name,
    version: 4
  })
  if (!createResp.ok) throw new Error('CreateArtifact: response not ok')

  const zipStream = await createZipUploadStream(spec)
  const uploadResult = await uploadZipToBlobStorage(createResp.signedUploadUrl, zipStream)

  const finalizeReq = {
    workflowRunBackendId: backendIds.workflowRunBackendId,
    workflowJobRunBackendId: backendIds.workflowJobRunBackendId,
    name,
    size: uploadResult.uploadSize ? uploadResult.uploadSize.toString() : '0'
  }
  if (uploadResult.sha256Hash)
    finalizeReq.hash = StringValue.create({ value: `sha256:${uploadResult.sha256Hash}` })

  const finalizeResp = await client.FinalizeArtifact(finalizeReq)
  if (!finalizeResp.ok) throw new Error('FinalizeArtifact: response not ok')
  console.log(`artifact ${name} uploaded id=${finalizeResp.artifactId} size=${uploadResult.uploadSize}`)
}

main().catch(e => { console.error(e); process.exit(1) })
