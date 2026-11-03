// audiocap.exe — captura todo o áudio do PC MENOS o Discord e escreve no stdout.
// Formato de saída: PCM 16-bit, 48000 Hz, estéreo intercalado.
// Usa o "process loopback" do Windows 10 2004+ (build 19041) em modo de exclusão.
// Termina sozinho quando o stdin fecha (o app fechou ou parou de compartilhar).
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <initguid.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <tlhelp32.h>
#include <fcntl.h>
#include <io.h>
#include <cstdio>
#include <cwchar>

// --- De audioclientactivationparams.h (não existe no MinGW) ---
enum AUDIOCLIENT_ACTIVATION_TYPE { AUDIOCLIENT_ACTIVATION_TYPE_DEFAULT = 0, AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK = 1 };
enum PROCESS_LOOPBACK_MODE { PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE = 0, PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE = 1 };
struct AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS { DWORD TargetProcessId; PROCESS_LOOPBACK_MODE ProcessLoopbackMode; };
struct AUDIOCLIENT_ACTIVATION_PARAMS {
  AUDIOCLIENT_ACTIVATION_TYPE ActivationType;
  union { AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS ProcessLoopbackParams; };
};
static const wchar_t* VAD_PROCESS_LOOPBACK = L"VAD\\Process_Loopback";
// IAgileObject: o handler de ativação precisa ser "agile" senão a ativação falha
static const GUID IID_Agile = {0x94ea2b94, 0xe9cc, 0x49e0, {0xc0, 0xff, 0xee, 0x64, 0xca, 0x8f, 0x5b, 0x90}};

typedef HRESULT (WINAPI *ActivateFn)(LPCWSTR, REFIID, PROPVARIANT*, IActivateAudioInterfaceCompletionHandler*, IActivateAudioInterfaceAsyncOperation**);

static void falha(const char* msg, HRESULT hr) {
  fprintf(stderr, "audiocap: %s (0x%08lx)\n", msg, (unsigned long)hr);
  ExitProcess(1);
}

// Processo raiz do Discord (aquele cujo pai não é Discord). Excluir a árvore dele tira
// todas as vozes, porque o áudio da call roda num processo filho.
static DWORD pidDoDiscord() {
  const wchar_t* nomes[] = {L"Discord.exe", L"DiscordPTB.exe", L"DiscordCanary.exe"};
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snap == INVALID_HANDLE_VALUE) return 0;
  static PROCESSENTRY32W lista[4096]; int n = 0;  // static: ~2 MB não cabe na pilha
  PROCESSENTRY32W pe = {sizeof(pe)};
  for (BOOL ok = Process32FirstW(snap, &pe); ok && n < 4096; ok = Process32NextW(snap, &pe)) lista[n++] = pe;
  CloseHandle(snap);
  auto ehDiscord = [&](const wchar_t* exe) {
    for (auto nome : nomes) if (_wcsicmp(exe, nome) == 0) return true;
    return false;
  };
  for (int i = 0; i < n; i++) {
    if (!ehDiscord(lista[i].szExeFile)) continue;
    bool paiDiscord = false;
    for (int j = 0; j < n; j++)
      if (lista[j].th32ProcessID == lista[i].th32ParentProcessID && ehDiscord(lista[j].szExeFile)) paiDiscord = true;
    if (!paiDiscord) return lista[i].th32ProcessID;
  }
  return 0;
}

struct Handler : IActivateAudioInterfaceCompletionHandler {
  HANDLE pronto = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppv) override {
    if (riid == IID_IUnknown || riid == IID_IActivateAudioInterfaceCompletionHandler || riid == IID_Agile) {
      *ppv = this; return S_OK;
    }
    *ppv = nullptr; return E_NOINTERFACE;
  }
  ULONG STDMETHODCALLTYPE AddRef() override { return 1; }   // vive a vida toda do processo
  ULONG STDMETHODCALLTYPE Release() override { return 1; }
  HRESULT STDMETHODCALLTYPE ActivateCompleted(IActivateAudioInterfaceAsyncOperation*) override {
    SetEvent(pronto); return S_OK;
  }
};

static DWORD WINAPI vigiarStdin(LPVOID) {
  char b[64]; DWORD lidos;
  HANDLE in = GetStdHandle(STD_INPUT_HANDLE);
  while (ReadFile(in, b, sizeof b, &lidos, nullptr) && lidos > 0) {}
  ExitProcess(0);
}

int main() {
  _setmode(_fileno(stdout), _O_BINARY);
  CreateThread(nullptr, 0, vigiarStdin, nullptr, 0, nullptr);
  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(hr)) falha("CoInitializeEx", hr);

  DWORD alvo = pidDoDiscord();
  // shortcut: se o Discord abrir depois de começar a compartilhar, o som dele entra; compartilhe de novo
  if (!alvo) alvo = GetCurrentProcessId();
  fprintf(stderr, "audiocap: excluindo pid %lu\n", (unsigned long)alvo);

  auto activate = (ActivateFn)GetProcAddress(LoadLibraryW(L"Mmdevapi.dll"), "ActivateAudioInterfaceAsync");
  if (!activate) falha("Windows sem ActivateAudioInterfaceAsync", E_NOTIMPL);

  AUDIOCLIENT_ACTIVATION_PARAMS params = {};
  params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
  params.ProcessLoopbackParams.TargetProcessId = alvo;
  params.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;
  PROPVARIANT pv = {};
  pv.vt = VT_BLOB;
  pv.blob.cbSize = sizeof(params);
  pv.blob.pBlobData = (BYTE*)&params;

  Handler handler;
  IActivateAudioInterfaceAsyncOperation* op = nullptr;
  hr = activate(VAD_PROCESS_LOOPBACK, IID_IAudioClient, &pv, &handler, &op);
  if (FAILED(hr)) falha("ActivateAudioInterfaceAsync (precisa Windows 10 2004 ou mais novo)", hr);
  WaitForSingleObject(handler.pronto, INFINITE);

  HRESULT hrAtivacao; IUnknown* unk = nullptr;
  hr = op->GetActivateResult(&hrAtivacao, &unk);
  if (FAILED(hr) || FAILED(hrAtivacao)) falha("ativacao do loopback", FAILED(hr) ? hr : hrAtivacao);
  IAudioClient* client = nullptr;
  hr = unk->QueryInterface(IID_IAudioClient, (void**)&client);
  if (FAILED(hr)) falha("IAudioClient", hr);

  WAVEFORMATEX wf = {};
  wf.wFormatTag = WAVE_FORMAT_PCM;
  wf.nChannels = 2;
  wf.nSamplesPerSec = 48000;
  wf.wBitsPerSample = 16;
  wf.nBlockAlign = wf.nChannels * wf.wBitsPerSample / 8;
  wf.nAvgBytesPerSec = wf.nSamplesPerSec * wf.nBlockAlign;

  hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                          AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
                          200000 /* 20 ms */, 0, &wf, nullptr);
  if (FAILED(hr)) falha("IAudioClient::Initialize", hr);

  HANDLE evento = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  client->SetEventHandle(evento);
  IAudioCaptureClient* cap = nullptr;
  hr = client->GetService(IID_IAudioCaptureClient, (void**)&cap);
  if (FAILED(hr)) falha("IAudioCaptureClient", hr);
  hr = client->Start();
  if (FAILED(hr)) falha("Start", hr);

  static BYTE zeros[48000 * 4];
  for (;;) {
    WaitForSingleObject(evento, 100);
    UINT32 pacote = 0;
    while (SUCCEEDED(cap->GetNextPacketSize(&pacote)) && pacote > 0) {
      BYTE* dados; UINT32 frames; DWORD flags;
      if (FAILED(cap->GetBuffer(&dados, &frames, &flags, nullptr, nullptr))) break;
      size_t bytes = (size_t)frames * wf.nBlockAlign;
      bool silencio = flags & AUDCLNT_BUFFERFLAGS_SILENT;
      if (silencio && bytes > sizeof zeros) bytes = sizeof zeros;
      const BYTE* src = silencio ? zeros : dados;
      if (fwrite(src, 1, bytes, stdout) != bytes) ExitProcess(0);  // app fechou o pipe
      cap->ReleaseBuffer(frames);
    }
    fflush(stdout);
  }
}
