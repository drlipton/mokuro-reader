<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Button, P, Progressbar } from 'flowbite-svelte';
  import { GoogleSolid } from 'flowbite-svelte-icons';
  import { processFiles } from '$lib/upload';
  import { formatBytes, showSnackbar, uploadFile, promptConfirmation } from '$lib/util';
  import { profiles, volumes } from '$lib/settings';
  import Loader from '$lib/components/Loader.svelte';

  // --- GOOGLE API CONFIG ---
  const CLIENT_ID = import.meta.env.VITE_GDRIVE_CLIENT_ID;
  const API_KEY = import.meta.env.VITE_GDRIVE_API_KEY;
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';

  // --- GDRIVE CONSTANTS ---
  const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
  const READER_FOLDER = 'mokuro-reader';
  const VOLUME_DATA_FILE = 'volume-data.json';
  const PROFILES_FILE = 'profiles.json';
  const JSON_MIME_TYPE = 'application/json';

  // --- STATE ---
  let gapi: any;
  let google: any;
  let tokenClient: any;
  let accessToken = '';
  let isReady = false; // True when scripts are loaded and gapi is initialized
  let isSignedIn = false;

  let readerFolderId = '';
  let volumeDataId = '';
  let profilesId = '';

  let loadingMessage = '';
  let completedBytes = 0;
  let totalBytes = 0;
  $: progressPercent = Math.floor((completedBytes / totalBytes) * 100).toString();
  
  let checkInterval: NodeJS.Timeout;

  // --- LIFECYCLE ---
  onMount(() => {
    // Poll until the Google scripts loaded from app.html are ready
    checkInterval = setInterval(() => {
        if (window.gapi && window.google) {
            clearInterval(checkInterval);
            gapi = window.gapi;
            google = window.google;
            gapi.load('client:picker', initializeGapiClient);
        }
    }, 100);
  });
  
  onDestroy(() => {
    clearInterval(checkInterval);
  });
  
  // --- GOOGLE API LOGIC ---
  async function initializeGapiClient() {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp: any) => { // This is the callback after user signs in
        if (resp.error) {
          showSnackbar(`Error: ${resp.error}`);
          throw resp;
        }
        isSignedIn = true;
        accessToken = resp.access_token;
        localStorage.setItem('gdrive_token', accessToken);
        connectDrive();
      },
    });

    isReady = true; // APIs are now ready for auth calls

    // Check for existing token to auto-sign-in
    const storedToken = localStorage.getItem('gdrive_token');
    if (storedToken) {
        gapi.client.setToken({ access_token: storedToken });
        if (gapi.client.getToken()?.access_token) {
            isSignedIn = true;
            accessToken = storedToken;
            connectDrive();
        } else {
            localStorage.removeItem('gdrive_token');
        }
    }
  }

  function handleAuthClick() {
    if (!tokenClient) {
        showSnackbar('Google Auth is not ready yet.');
        return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  async function connectDrive() {
    loadingMessage = 'Connecting to Drive...';
    try {
        const { result: folderRes } = await gapi.client.drive.files.list({
            q: `mimeType='${FOLDER_MIME_TYPE}' and name='${READER_FOLDER}' and trashed=false`,
            fields: 'files(id)'
        });

        if (folderRes.files?.length > 0) {
            readerFolderId = folderRes.files[0].id;
        } else {
            const { result: createRes } = await gapi.client.drive.files.create({
                resource: { name: READER_FOLDER, mimeType: FOLDER_MIME_TYPE },
                fields: 'id'
            });
            readerFolderId = createRes.id;
        }
        localStorage.setItem('readerFolderId', readerFolderId);

        const { result: filesRes } = await gapi.client.drive.files.list({
             q: `'${readerFolderId}' in parents and trashed=false`,
             fields: 'files(id, name)'
        });
        volumeDataId = filesRes.files?.find((f: any) => f.name === VOLUME_DATA_FILE)?.id || '';
        profilesId = filesRes.files?.find((f: any) => f.name === PROFILES_FILE)?.id || '';
        localStorage.setItem('volumeDataId', volumeDataId);
        localStorage.setItem('profilesId', profilesId);
        
    } catch (err) {
        showSnackbar('Error connecting to Google Drive.');
        console.error(err);
    } finally {
        loadingMessage = '';
    }
  }

  function createPicker() {
    if (!accessToken || !google.picker) {
        showSnackbar('Authentication token or Picker API is missing. Please sign in again.');
        return;
    }
    const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes('application/zip,application/x-zip-compressed,.cbz')
      .setMode(google.picker.DocsViewMode.LIST)
      .setIncludeFolders(true)
      .setParent(readerFolderId);
    
    const picker = new google.picker.PickerBuilder()
      .addView(docsView)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  }

  async function pickerCallback(data: any) {
    if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
      loadingMessage = 'Downloading from Drive...';
      try {
        const doc = data[google.picker.Response.DOCUMENTS][0];
        const blob = await downloadFile(doc.id);
        const file = new File([blob], doc.name);
        
        loadingMessage = 'Adding to catalog...';
        await processFiles([file]);
        showSnackbar(`${doc.name} added to your local library!`);

      } catch (error) {
        showSnackbar('Failed to process file from Drive.');
        console.error(error);
      } finally {
        loadingMessage = '';
      }
    }
  }

  // --- FILE HELPERS ---
  function downloadFile(fileId: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.responseType = 'blob';
      
      xhr.onprogress = (e) => {
        if (e.lengthComputable) {
          completedBytes = e.loaded;
          totalBytes = e.total;
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
            resolve(xhr.response);
        } else {
            reject(new Error(`Download failed: Status ${xhr.status}`));
        }
        completedBytes = 0;
        totalBytes = 0;
      };
      xhr.onerror = () => reject(new Error('Error downloading file.'));
      xhr.send();
    });
  }

  async function handleUpload(fileName: string, localStorageId: string, fileId: string) {
     const metadata = { name: fileName, mimeType: JSON_MIME_TYPE, parents: fileId ? undefined : [readerFolderId] };
     loadingMessage = `Uploading ${fileName}...`;
     try {
        const res = await uploadFile({ accessToken, fileId, metadata, localStorageId, type: JSON_MIME_TYPE });
        if (res.id) {
            showSnackbar(`${fileName} uploaded successfully.`);
            if (fileName === VOLUME_DATA_FILE) volumeDataId = res.id;
            if (fileName === PROFILES_FILE) profilesId = res.id;
        }
     } catch(err) {
        showSnackbar(`Failed to upload ${fileName}.`);
        console.error(err);
     } finally {
        loadingMessage = '';
     }
  }

  async function handleDownload(fileName: string, fileId: string) {
    if (!fileId) return;
    loadingMessage = `Downloading ${fileName}...`;
    try {
        const { body } = await gapi.client.drive.files.get({ fileId, alt: 'media' });
        const downloaded = JSON.parse(body);
        if (fileName === VOLUME_DATA_FILE) {
            volumes.set({ ...($volumes || {}), ...downloaded });
        } else if (fileName === PROFILES_FILE) {
            profiles.set({ ...($profiles || {}), ...downloaded });
        }
        showSnackbar(`${fileName} synced.`);
    } catch(err) {
        showSnackbar(`Failed to download ${fileName}.`);
        console.error(err);
    } finally {
        loadingMessage = '';
    }
  }
</script>

{#if loadingMessage || totalBytes > 0}
  <Loader>
    {#if totalBytes > 0}
      <P>{formatBytes(completedBytes)} / {formatBytes(totalBytes)}</P>
      <Progressbar progress={progressPercent} />
    {:else}
      {loadingMessage}
    {/if}
  </Loader>
{:else if !isReady}
    <div class="text-center">
        <Loader>Initializing Google Drive...</Loader>
    </div>
{:else if !isSignedIn}
  <div class="text-center">
    <p class="mb-4 text-gray-400">Connect your Google Drive account to sync your settings and download manga.</p>
    <Button on:click={handleAuthClick}>
      <GoogleSolid class="w-5 h-5 mr-2" />
      Sign in with Google
    </Button>
  </div>
{:else}
  <div class="flex flex-col gap-4 w-full">
    <p class="text-center text-gray-400">
        Add zipped manga files to the <span class="font-semibold text-primary-500">{READER_FOLDER}</span> folder in your Google Drive, then add them to your local library here.
    </p>
    <Button color="blue" on:click={createPicker}>Add Manga from Drive</Button>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Button color="dark" on:click={() => promptConfirmation('Upload volume data?', () => handleUpload(VOLUME_DATA_FILE, 'volumes', volumeDataId))}>
            Upload Progress
        </Button>
        <Button color="alternative" disabled={!volumeDataId} on:click={() => promptConfirmation('Download & merge progress?', () => handleDownload(VOLUME_DATA_FILE, volumeDataId))}>
            Download Progress
        </Button>
        <Button color="dark" on:click={() => promptConfirmation('Upload profiles?', () => handleUpload(PROFILES_FILE, 'profiles', profilesId))}>
            Upload Profiles
        </Button>
        <Button color="alternative" disabled={!profilesId} on:click={() => promptConfirmation('Download & overwrite profiles?', () => handleDownload(PROFILES_FILE, profilesId))}>
            Download Profiles
        </Button>
    </div>
  </div>
{/if}