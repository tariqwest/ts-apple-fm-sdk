use libc::{c_char, c_int, c_uint, c_double, c_void, size_t};
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode};
// NOTE: All StringCallback TSFNs use ErrorStrategy::Fatal so that the JS callback
// receives the JSON string as its first (and only) argument with no leading null/error
// parameter.  With the default ErrorStrategy::CalleeHandled the runtime prepends a
// `null` (success) or Error (failure) before the actual arguments, which caused the
// JS side in native.ts to receive `null` as the first arg instead of the JSON string.
use napi::JsFunction;
use napi_derive::napi;
use std::collections::HashMap;
use std::ffi::{CStr, CString};
use std::sync::{Mutex, OnceLock, atomic::{AtomicU64, Ordering}};

// ============================================================
// FFI declarations for libFoundationModels.dylib
// ============================================================

#[link(name = "FoundationModels")]
extern "C" {
    // SystemLanguageModel
    fn FMSystemLanguageModelGetDefault() -> *mut c_void;
    fn FMSystemLanguageModelCreate(use_case: c_int, guardrails: c_int) -> *mut c_void;
    fn FMSystemLanguageModelIsAvailable(model: *mut c_void, unavailable_reason: *mut c_int) -> bool;
    fn FMSystemLanguageModelGetContextSize(model: *mut c_void) -> c_int;

    // Session
    fn FMLanguageModelSessionCreateDefault() -> *mut c_void;
    fn FMLanguageModelSessionCreateFromSystemLanguageModel(
        model: *mut c_void,
        instructions: *const c_char,
        tools: *mut *mut c_void,
        tool_count: c_int,
    ) -> *mut c_void;
    fn FMLanguageModelSessionCreateFromTranscript(
        transcript_session: *mut c_void,
        model: *mut c_void,
        tools: *mut *mut c_void,
        tool_count: c_int,
    ) -> *mut c_void;
    fn FMLanguageModelSessionIsResponding(session: *mut c_void) -> bool;
    fn FMLanguageModelSessionReset(session: *mut c_void);

    // Composed prompt
    fn FMComposedPromptInitialize() -> *mut c_void;
    fn FMComposedPromptAddText(composed_prompt: *mut c_void, text: *const c_char);
    fn FMComposedPromptAddAttachment(
        composed_prompt: *mut c_void,
        image_path: *const c_char,
        label: *const c_char,
        error: *mut c_int,
    ) -> bool;

    // Response
    fn FMLanguageModelSessionRespond(
        session: *mut c_void,
        composed_prompt: *mut c_void,
        options_json: *const c_char,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, *const c_char, size_t, *mut c_void)>,
    ) -> *mut c_void;
    fn FMLanguageModelSessionStreamResponse(
        session: *mut c_void,
        composed_prompt: *mut c_void,
        options_json: *const c_char,
    ) -> *mut c_void;
    fn FMLanguageModelSessionResponseStreamIterate(
        stream: *mut c_void,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, *const c_char, size_t, *mut c_void)>,
    );

    // Structured response
    fn FMLanguageModelSessionRespondWithSchema(
        session: *mut c_void,
        composed_prompt: *mut c_void,
        schema: *mut c_void,
        options_json: *const c_char,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, *mut c_void, *mut c_void)>,
    ) -> *mut c_void;
    fn FMLanguageModelSessionRespondWithSchemaFromJSON(
        session: *mut c_void,
        composed_prompt: *mut c_void,
        schema_json: *const c_char,
        options_json: *const c_char,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, *mut c_void, *mut c_void)>,
    ) -> *mut c_void;

    // Token counting
    fn FMSystemLanguageModelTokenCountForPrompt(
        model: *mut c_void,
        composed_prompt: *mut c_void,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, c_int, *const c_char, *mut c_void)>,
    ) -> *mut c_void;
    fn FMSystemLanguageModelTokenCountForInstructions(
        model: *mut c_void,
        instructions: *const c_char,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, c_int, *const c_char, *mut c_void)>,
    ) -> *mut c_void;
    fn FMSystemLanguageModelTokenCountForTools(
        model: *mut c_void,
        tools: *mut *mut c_void,
        tool_count: c_int,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, c_int, *const c_char, *mut c_void)>,
    ) -> *mut c_void;
    fn FMSystemLanguageModelTokenCountForSchema(
        model: *mut c_void,
        schema: *mut c_void,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, c_int, *const c_char, *mut c_void)>,
    ) -> *mut c_void;
    fn FMSystemLanguageModelTokenCountForTranscript(
        model: *mut c_void,
        transcript_session: *mut c_void,
        user_info: *mut c_void,
        callback: Option<extern "C" fn(c_int, c_int, *const c_char, *mut c_void)>,
    ) -> *mut c_void;

    // Transcript
    fn FMTranscriptCreateFromJSONString(
        json_string: *const c_char,
        out_error_code: *mut c_int,
        out_error_description: *mut *mut c_char,
    ) -> *mut c_void;
    fn FMLanguageModelSessionGetTranscriptJSONString(
        session: *mut c_void,
        out_error_code: *mut c_int,
        out_error_description: *mut *mut c_char,
    ) -> *mut c_char;

    // GenerationSchema
    fn FMGenerationSchemaCreate(name: *const c_char, description: *const c_char) -> *mut c_void;
    fn FMGenerationSchemaPropertyCreate(
        name: *const c_char,
        description: *const c_char,
        type_name: *const c_char,
        is_optional: bool,
    ) -> *mut c_void;
    fn FMGenerationSchemaPropertyAddAnyOfGuide(
        property: *mut c_void,
        any_of: *const *const c_char,
        choice_count: c_int,
        wrapped: bool,
    );
    fn FMGenerationSchemaPropertyAddCountGuide(property: *mut c_void, count: c_int, wrapped: bool);
    fn FMGenerationSchemaPropertyAddMaximumGuide(property: *mut c_void, maximum: c_double, wrapped: bool);
    fn FMGenerationSchemaPropertyAddMinimumGuide(property: *mut c_void, minimum: c_double, wrapped: bool);
    fn FMGenerationSchemaPropertyAddMinItemsGuide(property: *mut c_void, min_items: c_int);
    fn FMGenerationSchemaPropertyAddMaxItemsGuide(property: *mut c_void, max_items: c_int);
    fn FMGenerationSchemaPropertyAddRangeGuide(
        property: *mut c_void,
        min_value: c_double,
        max_value: c_double,
        wrapped: bool,
    );
    fn FMGenerationSchemaPropertyAddRegex(property: *mut c_void, pattern: *const c_char, wrapped: bool);
    fn FMGenerationSchemaAddProperty(schema: *mut c_void, property: *mut c_void);
    fn FMGenerationSchemaAddReferenceSchema(schema: *mut c_void, reference_schema: *mut c_void);
    fn FMGenerationSchemaGetJSONString(
        schema: *mut c_void,
        out_error_code: *mut c_int,
        out_error_description: *mut *mut c_char,
    ) -> *mut c_char;

    // GeneratedContent
    fn FMGeneratedContentCreateFromJSON(
        json_string: *const c_char,
        out_error_code: *mut c_int,
        out_error_description: *mut *mut c_char,
    ) -> *mut c_void;
    fn FMGeneratedContentGetJSONString(content: *mut c_void) -> *mut c_char;
    fn FMGeneratedContentGetPropertyValue(
        content: *mut c_void,
        property_name: *const c_char,
        out_error_code: *mut c_int,
        out_error_description: *mut *mut c_char,
    ) -> *mut c_char;
    fn FMGeneratedContentIsComplete(content: *mut c_void) -> bool;

    // Tools
    fn FMBridgedToolCreate(
        name: *const c_char,
        description: *const c_char,
        parameters: *mut c_void,
        callable: Option<extern "C" fn(*mut c_void, c_uint)>,
        out_error_code: *mut c_int,
        out_error_description: *mut *mut c_char,
    ) -> *mut c_void;
    fn FMBridgedToolFinishCall(tool: *mut c_void, call_id: c_uint, output: *const c_char);

    // Memory management
    fn FMTaskCancel(task: *mut c_void);
    fn FMRetain(object: *mut c_void);
    fn FMRelease(object: *mut c_void);
    fn FMFreeString(str: *mut c_char);
}

// ============================================================
// Helpers
// ============================================================

fn take_c_string(ptr: *mut c_char) -> String {
    if ptr.is_null() {
        return String::new();
    }
    unsafe {
        let s = CStr::from_ptr(ptr).to_string_lossy().into_owned();
        FMFreeString(ptr);
        s
    }
}

fn to_c_string(s: &str) -> napi::Result<CString> {
    CString::new(s).map_err(|_| napi::Error::from_reason("String contained null byte".to_string()))
}

fn ptr_to_f64(ptr: *mut c_void) -> f64 {
    ptr as usize as f64
}

fn f64_to_ptr(v: f64) -> *mut c_void {
    v as usize as *mut c_void
}

// ============================================================
// Synchronous exports
// ============================================================

// --- Sanity checks ---

#[napi]
pub fn ping() -> i32 {
    42
}

#[napi]
pub fn hello(name: String) -> String {
    format!("Hello, {}!", name)
}

// --- SystemLanguageModel ---

#[napi(object)]
pub struct ModelAvailability {
    pub available: bool,
    #[napi(ts_type = "number | undefined")]
    pub reason: Option<i32>,
}

#[napi]
pub fn system_language_model_get_default() -> f64 {
    unsafe { ptr_to_f64(FMSystemLanguageModelGetDefault()) }
}

#[napi]
pub fn system_language_model_create(use_case: i32, guardrails: i32) -> f64 {
    unsafe { ptr_to_f64(FMSystemLanguageModelCreate(use_case, guardrails)) }
}

#[napi]
pub fn system_language_model_is_available(model: f64) -> napi::Result<ModelAvailability> {
    let mut reason: c_int = 0;
    let available = unsafe { FMSystemLanguageModelIsAvailable(f64_to_ptr(model), &mut reason) };
    Ok(ModelAvailability {
        available,
        reason: if available { None } else { Some(reason) },
    })
}

#[napi]
pub fn system_language_model_get_context_size(model: f64) -> i32 {
    unsafe { FMSystemLanguageModelGetContextSize(f64_to_ptr(model)) }
}

// --- Session ---

#[napi]
pub fn language_model_session_create_default() -> f64 {
    unsafe { ptr_to_f64(FMLanguageModelSessionCreateDefault()) }
}

#[napi]
pub fn language_model_session_create_from_system_language_model(
    model: Option<f64>,
    instructions: Option<String>,
    tools: Vec<f64>,
) -> napi::Result<f64> {
    let instructions_c = instructions.as_ref().map(|s| to_c_string(s)).transpose()?;
    let mut tool_ptrs: Vec<*mut c_void> = tools.iter().map(|&p| f64_to_ptr(p)).collect();
    let tool_ptrs_ptr = if tool_ptrs.is_empty() {
        std::ptr::null_mut()
    } else {
        tool_ptrs.as_mut_ptr()
    };
    let model_ptr = model.map(f64_to_ptr).unwrap_or(std::ptr::null_mut());
    unsafe {
        Ok(ptr_to_f64(FMLanguageModelSessionCreateFromSystemLanguageModel(
            model_ptr,
            instructions_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
            tool_ptrs_ptr,
            tools.len() as c_int,
        )))
    }
}

#[napi]
pub fn language_model_session_create_from_transcript(
    transcript: f64,
    model: Option<f64>,
    tools: Vec<f64>,
) -> napi::Result<f64> {
    let mut tool_ptrs: Vec<*mut c_void> = tools.iter().map(|&p| f64_to_ptr(p)).collect();
    let tool_ptrs_ptr = if tool_ptrs.is_empty() {
        std::ptr::null_mut()
    } else {
        tool_ptrs.as_mut_ptr()
    };
    let model_ptr = model.map(f64_to_ptr).unwrap_or(std::ptr::null_mut());
    unsafe {
        Ok(ptr_to_f64(FMLanguageModelSessionCreateFromTranscript(
            f64_to_ptr(transcript),
            model_ptr,
            tool_ptrs_ptr,
            tools.len() as c_int,
        )))
    }
}

#[napi]
pub fn language_model_session_is_responding(session: f64) -> bool {
    unsafe { FMLanguageModelSessionIsResponding(f64_to_ptr(session)) }
}

#[napi]
pub fn language_model_session_reset(session: f64) {
    unsafe { FMLanguageModelSessionReset(f64_to_ptr(session)) }
}

// --- Composed prompt ---

#[napi]
pub fn composed_prompt_initialize() -> f64 {
    unsafe { ptr_to_f64(FMComposedPromptInitialize()) }
}

#[napi]
pub fn composed_prompt_add_text(prompt: f64, text: String) -> napi::Result<()> {
    let text_c = to_c_string(&text)?;
    unsafe {
        FMComposedPromptAddText(f64_to_ptr(prompt), text_c.as_ptr());
    }
    Ok(())
}

#[napi]
pub fn composed_prompt_add_attachment(
    prompt: f64,
    image_path: String,
    label: Option<String>,
) -> napi::Result<bool> {
    let path_c = to_c_string(&image_path)?;
    let label_c = label.as_ref().map(|s| to_c_string(s)).transpose()?;
    let mut error: c_int = 0;
    let result = unsafe {
        FMComposedPromptAddAttachment(
            f64_to_ptr(prompt),
            path_c.as_ptr(),
            label_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
            &mut error,
        )
    };
    Ok(result)
}

// --- Transcript ---

#[napi]
pub fn transcript_create_from_json_string(json: String) -> napi::Result<f64> {
    let json_c = to_c_string(&json)?;
    let mut error_code: c_int = 0;
    let mut error_description: *mut c_char = std::ptr::null_mut();
    let ptr = unsafe {
        FMTranscriptCreateFromJSONString(json_c.as_ptr(), &mut error_code, &mut error_description)
    };
    if ptr.is_null() {
        return Err(napi::Error::from_reason(take_c_string(error_description)));
    }
    Ok(ptr_to_f64(ptr))
}

#[napi]
pub fn language_model_session_get_transcript_json_string(session: f64) -> napi::Result<String> {
    let mut error_code: c_int = 0;
    let mut error_description: *mut c_char = std::ptr::null_mut();
    let ptr = unsafe {
        FMLanguageModelSessionGetTranscriptJSONString(
            f64_to_ptr(session),
            &mut error_code,
            &mut error_description,
        )
    };
    if ptr.is_null() {
        return Err(napi::Error::from_reason(take_c_string(error_description)));
    }
    Ok(take_c_string(ptr))
}

// --- GenerationSchema ---

#[napi]
pub fn generation_schema_create(name: String, description: Option<String>) -> napi::Result<f64> {
    let name_c = to_c_string(&name)?;
    let description_c = description.as_ref().map(|s| to_c_string(s)).transpose()?;
    let ptr = unsafe {
        FMGenerationSchemaCreate(
            name_c.as_ptr(),
            description_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
        )
    };
    Ok(ptr_to_f64(ptr))
}

#[napi]
pub fn generation_schema_property_create(
    name: String,
    description: Option<String>,
    type_name: String,
    is_optional: bool,
) -> napi::Result<f64> {
    let name_c = to_c_string(&name)?;
    let description_c = description.as_ref().map(|s| to_c_string(s)).transpose()?;
    let type_name_c = to_c_string(&type_name)?;
    let ptr = unsafe {
        FMGenerationSchemaPropertyCreate(
            name_c.as_ptr(),
            description_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
            type_name_c.as_ptr(),
            is_optional,
        )
    };
    Ok(ptr_to_f64(ptr))
}

#[napi]
pub fn generation_schema_property_add_any_of_guide(
    property: f64,
    values: Vec<String>,
    wrapped: bool,
) -> napi::Result<()> {
    let c_values: Vec<CString> = values
        .iter()
        .map(|s| to_c_string(s))
        .collect::<Result<Vec<_>, _>>()?;
    let ptrs: Vec<*const c_char> = c_values.iter().map(|s| s.as_ptr()).collect();
    unsafe {
        FMGenerationSchemaPropertyAddAnyOfGuide(
            f64_to_ptr(property),
            ptrs.as_ptr(),
            ptrs.len() as c_int,
            wrapped,
        );
    }
    Ok(())
}

#[napi]
pub fn generation_schema_property_add_count_guide(
    property: f64,
    count: i32,
    wrapped: bool,
) -> napi::Result<()> {
    unsafe { FMGenerationSchemaPropertyAddCountGuide(f64_to_ptr(property), count, wrapped) };
    Ok(())
}

#[napi]
pub fn generation_schema_property_add_maximum_guide(
    property: f64,
    maximum: f64,
    wrapped: bool,
) -> napi::Result<()> {
    unsafe { FMGenerationSchemaPropertyAddMaximumGuide(f64_to_ptr(property), maximum, wrapped) };
    Ok(())
}

#[napi]
pub fn generation_schema_property_add_minimum_guide(
    property: f64,
    minimum: f64,
    wrapped: bool,
) -> napi::Result<()> {
    unsafe { FMGenerationSchemaPropertyAddMinimumGuide(f64_to_ptr(property), minimum, wrapped) };
    Ok(())
}

#[napi]
pub fn generation_schema_property_add_min_items_guide(
    property: f64,
    min_items: i32,
) -> napi::Result<()> {
    unsafe { FMGenerationSchemaPropertyAddMinItemsGuide(f64_to_ptr(property), min_items) };
    Ok(())
}

#[napi]
pub fn generation_schema_property_add_max_items_guide(
    property: f64,
    max_items: i32,
) -> napi::Result<()> {
    unsafe { FMGenerationSchemaPropertyAddMaxItemsGuide(f64_to_ptr(property), max_items) };
    Ok(())
}

#[napi]
pub fn generation_schema_property_add_range_guide(
    property: f64,
    min_value: f64,
    max_value: f64,
    wrapped: bool,
) -> napi::Result<()> {
    unsafe {
        FMGenerationSchemaPropertyAddRangeGuide(
            f64_to_ptr(property),
            min_value,
            max_value,
            wrapped,
        )
    };
    Ok(())
}

#[napi]
pub fn generation_schema_property_add_regex(
    property: f64,
    pattern: String,
    wrapped: bool,
) -> napi::Result<()> {
    let pattern_c = to_c_string(&pattern)?;
    unsafe { FMGenerationSchemaPropertyAddRegex(f64_to_ptr(property), pattern_c.as_ptr(), wrapped) };
    Ok(())
}

#[napi]
pub fn generation_schema_add_property(schema: f64, property: f64) {
    unsafe { FMGenerationSchemaAddProperty(f64_to_ptr(schema), f64_to_ptr(property)) }
}

#[napi]
pub fn generation_schema_add_reference_schema(schema: f64, reference_schema: f64) {
    unsafe { FMGenerationSchemaAddReferenceSchema(f64_to_ptr(schema), f64_to_ptr(reference_schema)) }
}

#[napi]
pub fn generation_schema_get_json_string(schema: f64) -> napi::Result<String> {
    let mut error_code: c_int = 0;
    let mut error_description: *mut c_char = std::ptr::null_mut();
    let ptr = unsafe {
        FMGenerationSchemaGetJSONString(
            f64_to_ptr(schema),
            &mut error_code,
            &mut error_description,
        )
    };
    if ptr.is_null() {
        return Err(napi::Error::from_reason(take_c_string(error_description)));
    }
    Ok(take_c_string(ptr))
}

// --- GeneratedContent ---

#[napi]
pub fn generated_content_create_from_json(json: String) -> napi::Result<f64> {
    let json_c = to_c_string(&json)?;
    let mut error_code: c_int = 0;
    let mut error_description: *mut c_char = std::ptr::null_mut();
    let ptr = unsafe {
        FMGeneratedContentCreateFromJSON(json_c.as_ptr(), &mut error_code, &mut error_description)
    };
    if ptr.is_null() {
        return Err(napi::Error::from_reason(take_c_string(error_description)));
    }
    Ok(ptr_to_f64(ptr))
}

#[napi]
pub fn generated_content_get_json_string(content: f64) -> String {
    unsafe { take_c_string(FMGeneratedContentGetJSONString(f64_to_ptr(content))) }
}

#[napi]
pub fn generated_content_get_property_value(
    content: f64,
    property_name: String,
) -> napi::Result<String> {
    let name_c = to_c_string(&property_name)?;
    let mut error_code: c_int = 0;
    let mut error_description: *mut c_char = std::ptr::null_mut();
    let ptr = unsafe {
        FMGeneratedContentGetPropertyValue(
            f64_to_ptr(content),
            name_c.as_ptr(),
            &mut error_code,
            &mut error_description,
        )
    };
    if ptr.is_null() {
        return Err(napi::Error::from_reason(take_c_string(error_description)));
    }
    Ok(take_c_string(ptr))
}

#[napi]
pub fn generated_content_is_complete(content: f64) -> bool {
    unsafe { FMGeneratedContentIsComplete(f64_to_ptr(content)) }
}

// --- Memory management ---

#[napi]
pub fn fm_retain(ptr: f64) {
    unsafe { FMRetain(f64_to_ptr(ptr)) }
}

#[napi]
pub fn fm_release(ptr: f64) {
    unsafe { FMRelease(f64_to_ptr(ptr)) }
}

#[napi]
pub fn fm_free_string(ptr: f64) {
    unsafe { FMFreeString(f64_to_ptr(ptr) as *mut c_char) }
}

#[napi]
pub fn fm_task_cancel(ptr: f64) {
    unsafe { FMTaskCancel(f64_to_ptr(ptr)) }
}

// ============================================================
// Callback infrastructure
// ============================================================

static CALLBACK_ID: AtomicU64 = AtomicU64::new(1);

type StringCallback = ThreadsafeFunction<String, ErrorStrategy::Fatal>;

static RESPONSE_CALLBACKS: OnceLock<Mutex<HashMap<u64, StringCallback>>> = OnceLock::new();
static STREAM_CALLBACKS: OnceLock<Mutex<HashMap<u64, StringCallback>>> = OnceLock::new();
static STRUCTURED_CALLBACKS: OnceLock<Mutex<HashMap<u64, StringCallback>>> = OnceLock::new();
static TOKEN_COUNT_CALLBACKS: OnceLock<Mutex<HashMap<u64, StringCallback>>> = OnceLock::new();

fn response_callbacks() -> &'static Mutex<HashMap<u64, StringCallback>> {
    RESPONSE_CALLBACKS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn stream_callbacks() -> &'static Mutex<HashMap<u64, StringCallback>> {
    STREAM_CALLBACKS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn structured_callbacks() -> &'static Mutex<HashMap<u64, StringCallback>> {
    STRUCTURED_CALLBACKS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn token_count_callbacks() -> &'static Mutex<HashMap<u64, StringCallback>> {
    TOKEN_COUNT_CALLBACKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_string_callback(
    callback: JsFunction,
    registry: &Mutex<HashMap<u64, StringCallback>>,
) -> napi::Result<u64> {
    let id = CALLBACK_ID.fetch_add(1, Ordering::Relaxed);
    let tsfn: StringCallback = callback.create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| {
        let env = ctx.env;
        let js_string = env.create_string(&ctx.value)?;
        Ok(vec![js_string])
    })?;
    registry.lock().unwrap().insert(id, tsfn);
    Ok(id)
}

fn call_string_callback(registry: &Mutex<HashMap<u64, StringCallback>>, id: u64, json: String) {
    if let Some(tsfn) = registry.lock().unwrap().get(&id) {
        let _ = tsfn.call(json, ThreadsafeFunctionCallMode::NonBlocking);
    }
}

fn remove_string_callback(registry: &Mutex<HashMap<u64, StringCallback>>, id: u64) {
    registry.lock().unwrap().remove(&id);
}

fn marshal_text_response(status: c_int, content: *const c_char, length: size_t) -> String {
    if status != 0 {
        return format!("{{\"type\":\"error\",\"payload\":{{\"status\":{}}}}}", status);
    }
    if content.is_null() {
        return "{\"type\":\"done\"}".to_string();
    }
    let text = unsafe {
        if length == 0 {
            CStr::from_ptr(content).to_string_lossy().into_owned()
        } else {
            String::from_utf8_lossy(std::slice::from_raw_parts(content as *const u8, length))
                .into_owned()
        }
    };
    // Use serde_json to correctly escape the text value so any embedded quotes,
    // backslashes, control characters, etc. are handled properly.
    let text_json = serde_json::to_string(&text).unwrap_or_else(|_| "\"\"".to_string());
    format!("{{\"type\":\"content\",\"payload\":{{\"text\":{}}}}}", text_json)
}

fn marshal_count_response(status: c_int, token_count: c_int, error_description: *const c_char) -> String {
    if status != 0 {
        let desc = if error_description.is_null() {
            String::new()
        } else {
            unsafe { CStr::from_ptr(error_description).to_string_lossy().into_owned() }
        };
        let desc_json = serde_json::to_string(&desc).unwrap_or_else(|_| "\"\"".to_string());
        return format!(
            "{{\"type\":\"error\",\"payload\":{{\"status\":{},\"description\":{}}}}}",
            status, desc_json
        );
    }
    format!("{{\"type\":\"count\",\"payload\":{{\"count\":{}}}}}", token_count)
}

extern "C" fn response_callback_trampoline(
    status: c_int,
    content: *const c_char,
    length: size_t,
    user_info: *mut c_void,
) {
    // FMLanguageModelSessionRespond calls this callback exactly ONCE with the full
    // response (on success) or an error.  It never sends a null-content "done" signal.
    // We therefore always fire both the content/error event AND a synthetic "done"
    // event so the JS side (which waits for null to resolve the promise) completes.
    let id = user_info as u64;
    let json = marshal_text_response(status, content, length);
    call_string_callback(response_callbacks(), id, json);
    // Always fire a "done" after the single callback to signal completion.
    let done_json = "{\"type\":\"done\"}".to_string();
    call_string_callback(response_callbacks(), id, done_json);
    remove_string_callback(response_callbacks(), id);
}

extern "C" fn stream_callback_trampoline(
    status: c_int,
    content: *const c_char,
    length: size_t,
    user_info: *mut c_void,
) {
    let id = user_info as u64;
    let json = marshal_text_response(status, content, length);
    let is_done = content.is_null() || status != 0;
    call_string_callback(stream_callbacks(), id, json);
    if is_done {
        remove_string_callback(stream_callbacks(), id);
    }
}

extern "C" fn structured_response_callback_trampoline(
    status: c_int,
    content: *mut c_void,
    user_info: *mut c_void,
) {
    let id = user_info as u64;
    let json = if status == 0 && !content.is_null() {
        format!(
            "{{\"type\":\"content\",\"payload\":{{\"contentPtr\":{}}}}}",
            content as usize
        )
    } else {
        format!("{{\"type\":\"error\",\"payload\":{{\"status\":{}}}}}", status)
    };
    call_string_callback(structured_callbacks(), id, json);
    remove_string_callback(structured_callbacks(), id);
}

extern "C" fn token_count_callback_trampoline(
    status: c_int,
    token_count: c_int,
    error_description: *const c_char,
    user_info: *mut c_void,
) {
    let id = user_info as u64;
    let json = marshal_count_response(status, token_count, error_description);
    call_string_callback(token_count_callbacks(), id, json);
    remove_string_callback(token_count_callbacks(), id);
}

// ============================================================
// Callback-based exports
// ============================================================

// --- Response ---

#[napi]
pub fn language_model_session_respond(
    session: f64,
    prompt: f64,
    options_json: Option<String>,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, response_callbacks())?;
    let options_c = options_json.as_ref().map(|s| to_c_string(s)).transpose()?;
    let task = unsafe {
        FMLanguageModelSessionRespond(
            f64_to_ptr(session),
            f64_to_ptr(prompt),
            options_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
            id as *mut c_void,
            Some(response_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

#[napi]
pub fn language_model_session_stream_response(
    session: f64,
    prompt: f64,
    options_json: Option<String>,
) -> napi::Result<f64> {
    let options_c = options_json.as_ref().map(|s| to_c_string(s)).transpose()?;
    let stream = unsafe {
        FMLanguageModelSessionStreamResponse(
            f64_to_ptr(session),
            f64_to_ptr(prompt),
            options_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
        )
    };
    Ok(ptr_to_f64(stream))
}

#[napi]
pub fn language_model_session_response_stream_iterate(
    stream: f64,
    callback: JsFunction,
) -> napi::Result<()> {
    let id = register_string_callback(callback, stream_callbacks())?;
    unsafe {
        FMLanguageModelSessionResponseStreamIterate(
            f64_to_ptr(stream),
            id as *mut c_void,
            Some(stream_callback_trampoline),
        );
    }
    Ok(())
}

// --- Structured response ---

#[napi]
pub fn language_model_session_respond_with_schema(
    session: f64,
    prompt: f64,
    schema: f64,
    options_json: Option<String>,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, structured_callbacks())?;
    let options_c = options_json.as_ref().map(|s| to_c_string(s)).transpose()?;
    let task = unsafe {
        FMLanguageModelSessionRespondWithSchema(
            f64_to_ptr(session),
            f64_to_ptr(prompt),
            f64_to_ptr(schema),
            options_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
            id as *mut c_void,
            Some(structured_response_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

#[napi]
pub fn language_model_session_respond_with_schema_from_json(
    session: f64,
    prompt: f64,
    schema_json: String,
    options_json: Option<String>,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, structured_callbacks())?;
    let schema_json_c = to_c_string(&schema_json)?;
    let options_c = options_json.as_ref().map(|s| to_c_string(s)).transpose()?;
    let task = unsafe {
        FMLanguageModelSessionRespondWithSchemaFromJSON(
            f64_to_ptr(session),
            f64_to_ptr(prompt),
            schema_json_c.as_ptr(),
            options_c.as_ref().map_or(std::ptr::null(), |s| s.as_ptr()),
            id as *mut c_void,
            Some(structured_response_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

// --- Token counting ---

#[napi]
pub fn system_language_model_token_count_for_prompt(
    model: f64,
    prompt: f64,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, token_count_callbacks())?;
    let task = unsafe {
        FMSystemLanguageModelTokenCountForPrompt(
            f64_to_ptr(model),
            f64_to_ptr(prompt),
            id as *mut c_void,
            Some(token_count_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

#[napi]
pub fn system_language_model_token_count_for_instructions(
    model: f64,
    instructions: String,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, token_count_callbacks())?;
    let instructions_c = to_c_string(&instructions)?;
    let task = unsafe {
        FMSystemLanguageModelTokenCountForInstructions(
            f64_to_ptr(model),
            instructions_c.as_ptr(),
            id as *mut c_void,
            Some(token_count_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

#[napi]
pub fn system_language_model_token_count_for_tools(
    model: f64,
    tools: Vec<f64>,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, token_count_callbacks())?;
    let mut tool_ptrs: Vec<*mut c_void> = tools.iter().map(|&p| f64_to_ptr(p)).collect();
    let tool_ptrs_ptr = if tool_ptrs.is_empty() {
        std::ptr::null_mut()
    } else {
        tool_ptrs.as_mut_ptr()
    };
    let task = unsafe {
        FMSystemLanguageModelTokenCountForTools(
            f64_to_ptr(model),
            tool_ptrs_ptr,
            tools.len() as c_int,
            id as *mut c_void,
            Some(token_count_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

#[napi]
pub fn system_language_model_token_count_for_schema(
    model: f64,
    schema: f64,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, token_count_callbacks())?;
    let task = unsafe {
        FMSystemLanguageModelTokenCountForSchema(
            f64_to_ptr(model),
            f64_to_ptr(schema),
            id as *mut c_void,
            Some(token_count_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

#[napi]
pub fn system_language_model_token_count_for_transcript(
    model: f64,
    transcript: f64,
    callback: JsFunction,
) -> napi::Result<f64> {
    let id = register_string_callback(callback, token_count_callbacks())?;
    let task = unsafe {
        FMSystemLanguageModelTokenCountForTranscript(
            f64_to_ptr(model),
            f64_to_ptr(transcript),
            id as *mut c_void,
            Some(token_count_callback_trampoline),
        )
    };
    Ok(ptr_to_f64(task))
}

// ============================================================
// Tool callbacks
// ============================================================

const MAX_TOOL_CALLBACKS: usize = 64;

static TOOL_CALLBACKS: OnceLock<Mutex<HashMap<usize, StringCallback>>> = OnceLock::new();

fn tool_callbacks() -> &'static Mutex<HashMap<usize, StringCallback>> {
    TOOL_CALLBACKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn tool_trampoline_inner(index: usize, content: *mut c_void, call_id: c_uint) {
    let json = format!(
        "{{\"contentPtr\":{},\"callId\":{}}}",
        content as usize,
        call_id
    );
    if let Some(tsfn) = tool_callbacks().lock().unwrap().get(&index) {
        let _ = tsfn.call(json, ThreadsafeFunctionCallMode::NonBlocking);
    }
}

macro_rules! define_tool_trampoline {
    ($idx:literal) => {
        paste::paste! {
            extern "C" fn [<tool_trampoline_ $idx>](content: *mut c_void, call_id: c_uint) {
                tool_trampoline_inner($idx, content, call_id);
            }
        }
    };
}

// Generate 64 per-tool trampolines so each tool can have its own JS callback.
// This is required because the C API's tool callback signature does not include
// a userInfo/context parameter.
define_tool_trampoline!(0);
define_tool_trampoline!(1);
define_tool_trampoline!(2);
define_tool_trampoline!(3);
define_tool_trampoline!(4);
define_tool_trampoline!(5);
define_tool_trampoline!(6);
define_tool_trampoline!(7);
define_tool_trampoline!(8);
define_tool_trampoline!(9);
define_tool_trampoline!(10);
define_tool_trampoline!(11);
define_tool_trampoline!(12);
define_tool_trampoline!(13);
define_tool_trampoline!(14);
define_tool_trampoline!(15);
define_tool_trampoline!(16);
define_tool_trampoline!(17);
define_tool_trampoline!(18);
define_tool_trampoline!(19);
define_tool_trampoline!(20);
define_tool_trampoline!(21);
define_tool_trampoline!(22);
define_tool_trampoline!(23);
define_tool_trampoline!(24);
define_tool_trampoline!(25);
define_tool_trampoline!(26);
define_tool_trampoline!(27);
define_tool_trampoline!(28);
define_tool_trampoline!(29);
define_tool_trampoline!(30);
define_tool_trampoline!(31);
define_tool_trampoline!(32);
define_tool_trampoline!(33);
define_tool_trampoline!(34);
define_tool_trampoline!(35);
define_tool_trampoline!(36);
define_tool_trampoline!(37);
define_tool_trampoline!(38);
define_tool_trampoline!(39);
define_tool_trampoline!(40);
define_tool_trampoline!(41);
define_tool_trampoline!(42);
define_tool_trampoline!(43);
define_tool_trampoline!(44);
define_tool_trampoline!(45);
define_tool_trampoline!(46);
define_tool_trampoline!(47);
define_tool_trampoline!(48);
define_tool_trampoline!(49);
define_tool_trampoline!(50);
define_tool_trampoline!(51);
define_tool_trampoline!(52);
define_tool_trampoline!(53);
define_tool_trampoline!(54);
define_tool_trampoline!(55);
define_tool_trampoline!(56);
define_tool_trampoline!(57);
define_tool_trampoline!(58);
define_tool_trampoline!(59);
define_tool_trampoline!(60);
define_tool_trampoline!(61);
define_tool_trampoline!(62);
define_tool_trampoline!(63);

fn tool_trampoline_for_index(index: usize) -> Option<extern "C" fn(*mut c_void, c_uint)> {
    let trampolines: [extern "C" fn(*mut c_void, c_uint); MAX_TOOL_CALLBACKS] = [
        tool_trampoline_0, tool_trampoline_1, tool_trampoline_2, tool_trampoline_3,
        tool_trampoline_4, tool_trampoline_5, tool_trampoline_6, tool_trampoline_7,
        tool_trampoline_8, tool_trampoline_9, tool_trampoline_10, tool_trampoline_11,
        tool_trampoline_12, tool_trampoline_13, tool_trampoline_14, tool_trampoline_15,
        tool_trampoline_16, tool_trampoline_17, tool_trampoline_18, tool_trampoline_19,
        tool_trampoline_20, tool_trampoline_21, tool_trampoline_22, tool_trampoline_23,
        tool_trampoline_24, tool_trampoline_25, tool_trampoline_26, tool_trampoline_27,
        tool_trampoline_28, tool_trampoline_29, tool_trampoline_30, tool_trampoline_31,
        tool_trampoline_32, tool_trampoline_33, tool_trampoline_34, tool_trampoline_35,
        tool_trampoline_36, tool_trampoline_37, tool_trampoline_38, tool_trampoline_39,
        tool_trampoline_40, tool_trampoline_41, tool_trampoline_42, tool_trampoline_43,
        tool_trampoline_44, tool_trampoline_45, tool_trampoline_46, tool_trampoline_47,
        tool_trampoline_48, tool_trampoline_49, tool_trampoline_50, tool_trampoline_51,
        tool_trampoline_52, tool_trampoline_53, tool_trampoline_54, tool_trampoline_55,
        tool_trampoline_56, tool_trampoline_57, tool_trampoline_58, tool_trampoline_59,
        tool_trampoline_60, tool_trampoline_61, tool_trampoline_62, tool_trampoline_63,
    ];
    trampolines.get(index).copied()
}

#[napi]
pub fn bridged_tool_create(
    name: String,
    description: String,
    parameters: f64,
    callback: JsFunction,
) -> napi::Result<f64> {
    let mut map = tool_callbacks().lock().unwrap();
    let index = (0..MAX_TOOL_CALLBACKS)
        .find(|i| !map.contains_key(i))
        .ok_or_else(|| napi::Error::from_reason("Too many bridged tools (max 64)".to_string()))?;

    let tsfn: StringCallback = callback.create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| {
        let env = ctx.env;
        let js_string = env.create_string(&ctx.value)?;
        Ok(vec![js_string])
    })?;
    map.insert(index, tsfn);
    drop(map);

    let name_c = to_c_string(&name)?;
    let description_c = to_c_string(&description)?;
    let trampoline = tool_trampoline_for_index(index).unwrap();

    let mut error_code: c_int = 0;
    let mut error_description: *mut c_char = std::ptr::null_mut();
    let tool = unsafe {
        FMBridgedToolCreate(
            name_c.as_ptr(),
            description_c.as_ptr(),
            f64_to_ptr(parameters),
            Some(trampoline),
            &mut error_code,
            &mut error_description,
        )
    };
    if tool.is_null() {
        // Free the slot on failure
        tool_callbacks().lock().unwrap().remove(&index);
        return Err(napi::Error::from_reason(take_c_string(error_description)));
    }
    Ok(ptr_to_f64(tool))
}

#[napi]
pub fn bridged_tool_finish_call(tool: f64, call_id: u32, output: String) -> napi::Result<()> {
    let output_c = to_c_string(&output)?;
    unsafe {
        FMBridgedToolFinishCall(f64_to_ptr(tool), call_id, output_c.as_ptr());
    }
    Ok(())
}

// Global active tool callback used by sessions that do not have per-tool bridging.
// The FoundationModels C API does not provide this natively, so this is a no-op
// stub that keeps the TypeScript interface complete. Real per-tool dispatch is
// handled by bridged_tool_create.
static ACTIVE_TOOL_CALLBACK: Mutex<Option<StringCallback>> = Mutex::new(None);

#[napi]
pub fn set_active_tool_callback(callback: JsFunction) -> napi::Result<()> {
    let tsfn: StringCallback = callback.create_threadsafe_function(0, |ctx: ThreadSafeCallContext<String>| {
        let env = ctx.env;
        let js_string = env.create_string(&ctx.value)?;
        Ok(vec![js_string])
    })?;
    let mut guard = ACTIVE_TOOL_CALLBACK.lock().unwrap();
    if let Some(old) = guard.take() {
        let _ = old.abort();
    }
    *guard = Some(tsfn);
    Ok(())
}
