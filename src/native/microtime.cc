#include "adone.h"
#include <errno.h>

#if ADONE_OS_WINDOWS

#include <time.h>

// Pick GetSystemTimePreciseAsFileTime or GetSystemTimeAsFileTime depending on which is available at runtime.
typedef VOID(WINAPI *WinGetSystemTime)(LPFILETIME);
static WinGetSystemTime getSystemTime = NULL;

struct timezone {
    int tz_minuteswest;
    int tz_dsttime;
};

int gettimeofday(struct timeval* tv, struct timezone* tz) {
    FILETIME ft;
    (*getSystemTime)(&ft);
    unsigned long long t = ft.dwHighDateTime;
    t <<= 32;
    t |= ft.dwLowDateTime;
    t /= 10;
    t -= 11644473600000000ULL;
    tv->tv_sec = (long)(t / 1000000UL);
    tv->tv_usec = (long)(t % 1000000UL);

    return 0;
}

#else

#include <sys/time.h>

#endif

void now(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    timeval t;
    int r = gettimeofday(&t, NULL);
    if (r < 0) {
        return Nan::ThrowError(Nan::ErrnoException(errno, "gettimeofday"));
    }

    info.GetReturnValue().Set(Nan::New<v8::Number>((t.tv_sec * 1000000.0) + t.tv_usec));
}

void nowDouble(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    timeval t;
    int r = gettimeofday(&t, NULL);
    if (r < 0) {
        return Nan::ThrowError(Nan::ErrnoException(errno, "gettimeofday"));
    }

    info.GetReturnValue().Set(Nan::New<v8::Number>(t.tv_sec + (t.tv_usec * 0.000001)));
}

void nowStruct(const Nan::FunctionCallbackInfo<v8::Value>& info) {
  timeval t;
  int r = gettimeofday(&t, NULL);
  if (r < 0) {
    return Nan::ThrowError(Nan::ErrnoException(errno, "gettimeofday"));
  }

  v8::Local<v8::Array> array = Nan::New<v8::Array>(2);
  array->Set(Nan::New<v8::Integer>(0), Nan::New<v8::Number>((double)t.tv_sec));
  array->Set(Nan::New<v8::Integer>(1), Nan::New<v8::Number>((double)t.tv_usec));

  info.GetReturnValue().Set(array);
}

NAN_MODULE_INIT(init) {
    Nan::Export(target, "now", now);
    Nan::Export(target, "nowDouble", nowDouble);
    Nan::Export(target, "nowStruct", nowStruct);

#if defined(_MSC_VER)
    getSystemTime = (WinGetSystemTime)GetProcAddress(GetModuleHandle(TEXT("kernel32.dll")), "GetSystemTimePreciseAsFileTime");
    if (getSystemTime == NULL) {
        getSystemTime = &GetSystemTimeAsFileTime;
    }
#endif
}

NODE_MODULE(microtime, init)
