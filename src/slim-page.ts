/**
 * The stand-in host for Laser Head Slim.
 *
 * This file is NOT part of the package — it is the handful of lines a real app
 * would write to use it. The package itself is `src/slim/`, and nothing in
 * there imports anything from here.
 */

import "./slim/slim.css";

import { initialsFor, mountSlimBanner, openSlimGame } from "./slim";

const slot = document.getElementById("banner-slot")!;
const INITIALS = initialsFor("Jesse Spencer");

const banner = mountSlimBanner(slot, {
  seed: INITIALS,
  // `turnDone` omitted on purpose: there is no job behind this banner, which
  // is a third state rather than a `false`.
  onPlay: () => openSlimGame({ initials: INITIALS, title: "Laser Head Mini" }),
  onDismiss: () => banner.destroy(),
});
