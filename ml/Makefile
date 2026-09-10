# One target per pipeline stage. Each stage reads ./config.yaml and
# writes parquet under ./data, so re-running a later stage never re-runs
# an earlier one. Usage: `make ingest`, `make features`, ...

PY := python

.PHONY: help venv ingest features engine-labels feature-models game-agg \
        player-vectors skill style traits export validate serve clean

help:
	@grep -E '^[a-z-]+:.*?##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | sort

venv: ## create .venv and install requirements
	python -m venv .venv && .venv/bin/pip install -U pip && .venv/bin/pip install -r requirements.txt

ingest: ## 01 - stream the Lichess dump -> data/<month>/{games,moves}/
	$(PY) pipeline/01_ingest.py

features: ## 02 - per-ply derived features -> data/<month>/move_features/
	$(PY) pipeline/02_move_features.py

engine-labels: ## 03 - Stockfish multipv labels on a sample (run on the spot VM)
	$(PY) pipeline/03_engine_labels.py

feature-models: ## 04 - train has_tactic / only_move / complexity / move-quality models
	$(PY) pipeline/04_feature_models.py

game-agg: ## 05 - per (game, player) feature rows
	$(PY) pipeline/05_game_agg.py

player-vectors: ## 06 - one vector per player
	$(PY) pipeline/06_player_vectors.py

skill: ## 07 - skill model (elo <- skill block)
	$(PY) pipeline/07_skill_model.py

style: ## 08 - residualize + PCA + UMAP + neighbour index
	$(PY) pipeline/08_style_embedding.py

traits: ## 09 - population wp_loss model + trait definitions
	$(PY) pipeline/09_trait_models.py

export: ## 10 - bundle everything into artifacts/
	$(PY) pipeline/10_export_artifacts.py

validate: ## 11 - stylometry / skill MAE / disentanglement / face-validity
	$(PY) pipeline/11_validate.py

serve: ## run the inference service locally
	uvicorn service.app:app --reload --port 8000

clean: ## remove working data (keeps artifacts/)
	rm -rf data/
