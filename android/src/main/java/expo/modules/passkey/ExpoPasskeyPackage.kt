package expo.modules.passkey

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModulePackage

class ExpoPasskeyPackage : ModulePackage() {
  override fun createModules(): List<Module> {
    return listOf(ExpoPasskeyModule())
  }
}