# The Kingdom

The Kingdom is Gekko's internal developer platform — the single operational picture of everything we build and run. Rather than each app living in its own silo with no shared visibility, the Kingdom gives us one place to watch, understand, and improve the whole portfolio.

## What it does

The Kingdom does three things:

**Watches every village.** The Steward polls every registered service every 5 minutes. The Master of Works watches CPU, memory, and disk. The Captain of the Guard classifies and escalates incidents. All of this runs continuously without manual intervention.

**Hosts the Royal Court.** Sixteen agents patrol the realm, each with a single narrow beat — from compliance auditing (Master of Laws) to dependency security scanning (Steward) to AI intelligence monitoring (Master of Whisperers). Every morning the Herald compiles their overnight findings into the Telegraph, a daily briefing delivered to the operator's Telegram.

**Documents the realm through the Scriptorium.** This site. Every village earns a page here — wiki articles explaining what it does, how it works, and how it connects to everything else. The goal is that nothing important lives only in someone's head.

## Why it exists

Before the Kingdom, we had several separate efforts: Admin Center (monitoring), The Bureau (briefings), individual app documentation scattered across repos. The Kingdom absorbs all of these into one mental model. One project, one place, one way for a new team member (or Barry) to understand what we've built.

## The Royal Court

Sixteen agents running continuously:

| Agent | Beat | Schedule |
|---|---|---|
| The Steward | Service health + dependency security | Every 5 min |
| The Master of Works | CPU, memory, disk, containers | Every 5 min |
| The Captain of the Guard | Incident detection and escalation | Every 5 min |
| The Quartermaster | Disk forecast and quota alerts | Hourly |
| The Maester | Institutional memory — what exists, what's stale | Daily |
| The Hand of the King | Task prioritisation and daily agenda | Every 30 min |
| The Master of Laws | Compliance audit against Gekko Standard | Weekly |
| The Master of Whisperers | AI/LLM intelligence from external sources | Daily |
| The Herald | Publishes the Telegraph morning briefing | Daily at 2AM CAT |
| The Lord Chamberlain | Support inbox triage | On-demand |
| The Master of Coin | Infrastructure spend signals | On-demand |
| The Master Builder | Build health monitoring | On-demand |
| The Castellan | Castle cleanliness and housekeeping | On-demand |
| The Scout | First-line tech support routing | On-demand |
| The Marshal | Issue routing to area and role | On-demand |
| The Inspector | Quality gate enforcement | On-demand |

See [[kingdom/status-metrics]] for the live numbers.

## Components

- **[[kingdom/capital-api]]** — the Capital API, the backend that holds the realm's data and receives events from every village. Replaced the legacy admin-center on 2026-05-27.
