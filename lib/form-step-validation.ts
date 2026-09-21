type ValidatableControl = Element & {
  reportValidity: () => boolean
}

/** Validate only the controls inside the currently visible form step. */
export function reportStepValidity(container: ParentNode | null): boolean {
  if (!container) return true

  const controls = Array.from(
    container.querySelectorAll("input, select, textarea"),
  ).filter((control): control is ValidatableControl => (
    "reportValidity" in control && typeof control.reportValidity === "function"
  ))

  for (const control of controls) {
    if (!control.reportValidity()) return false
  }

  return true
}
