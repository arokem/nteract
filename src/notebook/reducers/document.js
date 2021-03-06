import * as commutable from 'commutable';
import * as uuid from 'uuid';

import * as constants from '../constants';
import { handleActions } from 'redux-actions';

import Immutable from 'immutable';

export default handleActions({
  [constants.SET_NOTEBOOK]: function setNotebook(state, action) {
    const notebook = action.data;
    return state.set('notebook', notebook)
                .set('focusedCell', notebook.getIn(['cellOrder', 0]));
  },
  [constants.FOCUS_CELL]: function focusCell(state, action) {
    return state.set('focusedCell', action.id);
  },
  [constants.FOCUS_NEXT_CELL]: function focusNextCell(state, action) {
    const cellOrder = state.getIn(['notebook', 'cellOrder']);
    const curIndex = cellOrder.findIndex(id => id === action.id);

    const nextIndex = curIndex + 1;

    // When at the end, create a new cell
    if (nextIndex >= cellOrder.size) {
      if (!action.createCellIfUndefined) {
        return state;
      }

      const cellID = uuid.v4();
      // TODO: condition on state.defaultCellType (markdown vs. code)
      const cell = commutable.emptyCodeCell;
      return state.set('focusedCell', cellID)
                  .update('notebook',
                    (notebook) => commutable.insertCellAt(notebook, cell, cellID, nextIndex));
    }

    // When in the middle of the notebook document, move to the next cell
    return state.set('focusedCell', cellOrder.get(nextIndex));
  },
  [constants.FOCUS_PREVIOUS_CELL]: function focusPreviousCell(state, action) {
    const cellOrder = state.getIn(['notebook', 'cellOrder']);
    const curIndex = cellOrder.findIndex(id => id === action.id);
    const nextIndex = Math.max(0, curIndex - 1);

    return state.set('focusedCell', cellOrder.get(nextIndex));
  },
  [constants.TOGGLE_STICKY_CELL]: function toggleStickyCell(state, action) {
    const { id } = action;
    // TODO: Switch this structure to an Immutable.Set
    const stickyCells = state.get('stickyCells');
    if (stickyCells.get(id)) {
      return state.set('stickyCells', stickyCells.delete(id));
    }
    return state.setIn(['stickyCells', id], true);
  },
  [constants.UPDATE_CELL_EXECUTION_COUNT]: function updateExecutionCount(state, action) {
    const { id, count } = action;
    return state.update('notebook',
      (notebook) => commutable.updateExecutionCount(notebook, id, count));
  },
  [constants.MOVE_CELL]: function moveCell(state, action) {
    return state.updateIn(['notebook', 'cellOrder'],
      cellOrder => {
        const oldIndex = cellOrder.findIndex(id => id === action.id);
        const newIndex = cellOrder.findIndex(id => id === action.destinationId)
                          + (action.above ? 0 : 1);
        if (oldIndex === newIndex) {
          return cellOrder;
        }
        return cellOrder
          .splice(oldIndex, 1)
          .splice(newIndex - (oldIndex < newIndex ? 1 : 0), 0, action.id);
      }
    );
  },
  [constants.REMOVE_CELL]: function removeCell(state, action) {
    const { id } = action;
    return state.update('notebook',
      (notebook) => commutable.removeCell(notebook, id)
    );
  },
  [constants.NEW_CELL_AFTER]: function newCellAfter(state, action) {
    const { cellType, id, source } = action;
    const cell = cellType === 'markdown' ? commutable.emptyMarkdownCell :
                                           commutable.emptyCodeCell;
    const cellID = uuid.v4();
    return state.update('notebook', (notebook) => {
      const index = notebook.get('cellOrder').indexOf(id) + 1;
      return commutable.insertCellAt(notebook, cell.set('source', source), cellID, index);
    });
  },
  [constants.NEW_CELL_BEFORE]: function newCellBefore(state, action) {
    // Draft API
    const { cellType, id } = action;
    const cell = cellType === 'markdown' ? commutable.emptyMarkdownCell :
                                           commutable.emptyCodeCell;
    const cellID = uuid.v4();
    return state.update('notebook', (notebook) => {
      const index = notebook.get('cellOrder').indexOf(id);
      return commutable.insertCellAt(notebook, cell, cellID, index);
    });
  },
  [constants.MERGE_CELL_AFTER]: function mergeCellAfter(state, action) {
    const { id } = action;
    const cellOrder = state.getIn(['notebook', 'cellOrder']);
    const index = cellOrder.indexOf(id);
    // do nothing if this is the last cell
    if (cellOrder.size === index + 1) {
      return state;
    }
    const cellMap = state.getIn(['notebook', 'cellMap']);

    const nextId = cellOrder.get(index + 1);
    const source = cellMap.getIn([id, 'source'])
                          .concat('\n', '\n', cellMap.getIn([nextId, 'source']));

    return state.update('notebook',
      (notebook) => commutable.removeCell(commutable.updateSource(notebook, id, source), nextId)
    );
  },
  [constants.NEW_CELL_APPEND]: function newCellAppend(state, action) {
    // Draft API
    const { cellType } = action;
    const notebook = state.get('notebook');
    const cell = cellType === 'markdown' ? commutable.emptyMarkdownCell :
                                           commutable.emptyCodeCell;
    const index = notebook.get('cellOrder').count();
    const cellID = uuid.v4();
    return state.set('notebook',
      commutable.insertCellAt(notebook, cell, cellID, index)
    );
  },
  [constants.UPDATE_CELL_SOURCE]: function updateSource(state, action) {
    const { id, source } = action;
    return state.update('notebook', (notebook) => commutable.updateSource(notebook, id, source));
  },
  [constants.CLEAR_CELL_OUTPUT]: function clearCellOutput(state, action) {
    const { id } = action;
    return state.update('notebook', (notebook) => commutable.clearCellOutput(notebook, id));
  },
  [constants.UPDATE_CELL_OUTPUTS]: function updateOutputs(state, action) {
    const { id, outputs } = action;
    return state.update('notebook', (notebook) => commutable.updateOutputs(notebook, id, outputs));
  },
  [constants.UPDATE_CELL_PAGERS]: function updateCellPagers(state, action) {
    const { id, pagers } = action;
    return state.setIn(['cellPagers', id], pagers);
  },
  [constants.UPDATE_CELL_STATUS]: function updateCellStatus(state, action) {
    const { id, status } = action;
    return state.setIn(['cellStatuses', id], status);
  },
  [constants.SET_LANGUAGE_INFO]: function setLanguageInfo(state, action) {
    const langInfo = Immutable.fromJS(action.langInfo);
    return state.setIn(['notebook', 'metadata', 'language_info'], langInfo);
  },
  [constants.OVERWRITE_METADATA_FIELD]: function overwriteMetadata(state, action) {
    const { field, value } = action;
    return state.setIn(['notebook', 'metadata', field], Immutable.fromJS(value));
  },
}, {});
