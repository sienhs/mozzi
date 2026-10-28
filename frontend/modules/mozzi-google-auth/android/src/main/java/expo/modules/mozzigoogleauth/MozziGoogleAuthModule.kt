package expo.modules.mozzigoogleauth

import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MozziGoogleAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MozziGoogleAuth")

    AsyncFunction("signInAsync") Coroutine { webClientId: String ->
      withContext(Dispatchers.Main) {
        val activity = appContext.currentActivity
          ?: throw CodedException("ERR_GOOGLE_ACTIVITY", "로그인 화면을 다시 열어 주세요.", null)
        val option = GetSignInWithGoogleOption.Builder(webClientId).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        try {
          val credential = CredentialManager.create(activity).getCredential(activity, request).credential
          if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            throw CodedException("ERR_GOOGLE_TOKEN", "Google 계정을 확인하지 못했어요.", null)
          }
          GoogleIdTokenCredential.createFrom(credential.data).idToken
        } catch (_: GetCredentialCancellationException) {
          null
        } catch (error: GetCredentialException) {
          throw CodedException("ERR_GOOGLE_SIGN_IN", "Google 로그인에 실패했어요. 다시 시도해 주세요.", error)
        }
      }
    }

    AsyncFunction("clearAsync") Coroutine { ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_GOOGLE_CONTEXT", "앱을 다시 열어 주세요.", null)
      CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
    }
  }
}
