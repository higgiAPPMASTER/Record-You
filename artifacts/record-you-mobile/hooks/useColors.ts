import colors from "@/constants/colors";

/**
 * Record You is a late-night studio app — always uses the dark palette
 * to match the sibling web artifact, regardless of the device's
 * appearance setting.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
