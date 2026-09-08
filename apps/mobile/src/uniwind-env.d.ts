/**
 * Pulls in Uniwind's module augmentation for react-native, which is what adds
 * `className` to View, Text and friends, plus `contentContainerClassName` and
 * `columnWrapperClassName` on the scrolling components.
 *
 * Separate from the generated `uniwind-types.d.ts`, which Metro writes on first
 * run and which types the class strings themselves.
 */
import "uniwind/types";
