#include "../adone.h"

#define UNI_SUR_HIGH_START (uint32_t)0xD800
#define UNI_SUR_LOW_END (uint32_t)0xDFFF
#define UNI_REPLACEMENT_CHAR (uint32_t)0x0000FFFD
#define UNI_MAX_LEGAL_UTF32 (uint32_t)0x0010FFFF

static const uint8_t trailingBytesForUTF8[256] = {
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5};

static const uint32_t offsetsFromUTF8[6] = {
    0x00000000, 0x00003080, 0x000E2080,
    0x03C82080, 0xFA082080, 0x82082080};

static int isLegalUTF8(const uint8_t *source, const int length)
{
    uint8_t a;
    const uint8_t *srcptr = source + length;
    switch (length)
    {
    default:
        return 0;
    /* Everything else falls through when "true"... */
    /* RFC3629 makes 5 & 6 bytes UTF-8 illegal
  case 6: if ((a = (*--srcptr)) < 0x80 || a > 0xBF) return 0;
  case 5: if ((a = (*--srcptr)) < 0x80 || a > 0xBF) return 0; */
    case 4:
        if ((a = (*--srcptr)) < 0x80 || a > 0xBF)
            return 0;
    case 3:
        if ((a = (*--srcptr)) < 0x80 || a > 0xBF)
            return 0;
    case 2:
        if ((a = (*--srcptr)) > 0xBF)
            return 0;
        switch (*source)
        {
        /* no fall-through in this inner switch */
        case 0xE0:
            if (a < 0xA0)
                return 0;
            break;
        case 0xED:
            if (a > 0x9F)
                return 0;
            break;
        case 0xF0:
            if (a < 0x90)
                return 0;
            break;
        case 0xF4:
            if (a > 0x8F)
                return 0;
            break;
        default:
            if (a < 0x80)
                return 0;
        }

    case 1:
        if (*source >= 0x80 && *source < 0xC2)
            return 0;
    }
    if (*source > 0xF4)
        return 0;
    return 1;
}

int is_valid_utf8(size_t len, char *value)
{
    /* is the string valid UTF-8? */
    for (unsigned int i = 0; i < len; i++)
    {
        uint32_t ch = 0;
        uint8_t extrabytes = trailingBytesForUTF8[(uint8_t)value[i]];

        if (extrabytes + i >= len)
            return 0;

        if (isLegalUTF8((uint8_t *)(value + i), extrabytes + 1) == 0)
            return 0;

        switch (extrabytes)
        {
        case 5:
            ch += (uint8_t)value[i++];
            ch <<= 6;
        case 4:
            ch += (uint8_t)value[i++];
            ch <<= 6;
        case 3:
            ch += (uint8_t)value[i++];
            ch <<= 6;
        case 2:
            ch += (uint8_t)value[i++];
            ch <<= 6;
        case 1:
            ch += (uint8_t)value[i++];
            ch <<= 6;
        case 0:
            ch += (uint8_t)value[i];
        }

        ch -= offsetsFromUTF8[extrabytes];

        if (ch <= UNI_MAX_LEGAL_UTF32)
        {
            if (ch >= UNI_SUR_HIGH_START && ch <= UNI_SUR_LOW_END)
                return 0;
        }
        else
        {
            return 0;
        }
    }

    return 1;
}

class WebSocket : public ObjectWrap
{
  public:
    static NAN_MODULE_INIT(Initialize)
    {
        Nan::HandleScope scope;
        Local<FunctionTemplate> t = Nan::New<FunctionTemplate>(New);
        t->InstanceTemplate()->SetInternalFieldCount(1);
        Nan::SetMethod(t, "unmask", WebSocket::Unmask);
        Nan::SetMethod(t, "mask", WebSocket::Mask);
        Nan::SetMethod(t, "isValidUTF8", WebSocket::IsValidUTF8);
        Nan::Set(target, Nan::New<String>("WebSocket").ToLocalChecked(), t->GetFunction());
    }

  protected:
    static NAN_METHOD(New)
    {
        Nan::HandleScope scope;
        WebSocket *ws = new WebSocket();
        ws->Wrap(info.This());
        info.GetReturnValue().Set(info.This());
    }

    static NAN_METHOD(Mask)
    {
        char *from = node::Buffer::Data(info[0]);
        char *mask = node::Buffer::Data(info[1]);
        char *to = node::Buffer::Data(info[2]) + info[3]->Int32Value();
        size_t length = info[4]->Int32Value();
        size_t index = 0;

        //
        // Alignment preamble.
        //
        while (index < length && (reinterpret_cast<size_t>(from) & 0x07))
        {
            *to++ = *from++ ^ mask[index % 4];
            index++;
        }
        length -= index;
        if (!length)
            return;

        //
        // Realign mask and convert to 64 bit.
        //
        char maskAlignedArray[8];

        for (size_t i = 0; i < 8; i++, index++)
        {
            maskAlignedArray[i] = mask[index % 4];
        }

        //
        // Apply 64 bit mask in 8 byte chunks.
        //
        size_t loop = length / 8;
        uint64_t *pMask8 = reinterpret_cast<uint64_t *>(maskAlignedArray);

        while (loop--)
        {
            uint64_t *pFrom8 = reinterpret_cast<uint64_t *>(from);
            uint64_t *pTo8 = reinterpret_cast<uint64_t *>(to);
            *pTo8 = *pFrom8 ^ *pMask8;
            from += 8;
            to += 8;
        }

        //
        // Apply mask to remaining data.
        //
        char *pmaskAlignedArray = maskAlignedArray;

        length &= 0x7;
        while (length--)
        {
            *to++ = *from++ ^ *pmaskAlignedArray++;
        }
    }

    static NAN_METHOD(Unmask)
    {
        char *from = node::Buffer::Data(info[0]);
        size_t length = node::Buffer::Length(info[0]);
        char *mask = node::Buffer::Data(info[1]);
        size_t index = 0;

        //
        // Alignment preamble.
        //
        while (index < length && (reinterpret_cast<size_t>(from) & 0x07))
        {
            *from++ ^= mask[index % 4];
            index++;
        }
        length -= index;
        if (!length)
            return;

        //
        // Realign mask and convert to 64 bit.
        //
        char maskAlignedArray[8];

        for (size_t i = 0; i < 8; i++, index++)
        {
            maskAlignedArray[i] = mask[index % 4];
        }

        //
        // Apply 64 bit mask in 8 byte chunks.
        //
        size_t loop = length / 8;
        uint64_t *pMask8 = reinterpret_cast<uint64_t *>(maskAlignedArray);

        while (loop--)
        {
            uint64_t *pSource8 = reinterpret_cast<uint64_t *>(from);
            *pSource8 ^= *pMask8;
            from += 8;
        }

        //
        // Apply mask to remaining data.
        //
        char *pmaskAlignedArray = maskAlignedArray;

        length &= 0x7;
        while (length--)
        {
            *from++ ^= *pmaskAlignedArray++;
        }
    }

    static NAN_METHOD(IsValidUTF8)
    {
        Nan::HandleScope scope;
        if (!Buffer::HasInstance(info[0]))
        {
            return Nan::ThrowTypeError("First argument needs to be a buffer");
        }
        Local<Object> buffer_obj = info[0]->ToObject();
        char *buffer_data = Buffer::Data(buffer_obj);
        size_t buffer_length = Buffer::Length(buffer_obj);
        info.GetReturnValue().Set(is_valid_utf8(buffer_length, buffer_data) == 1 ? Nan::True() : Nan::False());
    }
};

NODE_MODULE(ws, WebSocket::Initialize)