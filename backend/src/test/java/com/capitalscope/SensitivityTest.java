package com.capitalscope;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SensitivityTest {
    private DcfCalculator.Assumptions assumptions(double discount, double terminal) {
        return new DcfCalculator.Assumptions(100, 0, discount, terminal, 5, 100, 10);
    }
    @Test void iRecoverTheBaseCaseAndExpectedDirectionalChanges() {
        var grid = DcfSensitivity.calculate(assumptions(.1, 0));
        assertEquals(5, grid.rows().size());
        assertEquals(5, grid.terminalGrowthRates().size());
        var center = grid.rows().get(2).cells().get(2);
        assertTrue(center.baseCase());
        assertEquals(90, center.valuePerShare(), 1e-8);
        assertTrue(grid.rows().get(0).cells().get(2).valuePerShare() > center.valuePerShare());
        assertTrue(grid.rows().get(4).cells().get(2).valuePerShare() < center.valuePerShare());
        assertTrue(grid.rows().get(2).cells().get(4).valuePerShare() > center.valuePerShare());
        assertEquals(1, grid.rows().stream().flatMap(r -> r.cells().stream()).filter(DcfSensitivity.Cell::baseCase).count());
    }
    @Test void iMarkInvalidCellsWithoutInventingAValue() {
        var grid = DcfSensitivity.calculate(assumptions(.01, .005));
        assertNull(grid.rows().get(0).cells().get(0).valuePerShare());
        assertNotNull(grid.rows().get(0).cells().get(0).error());
        assertNull(grid.rows().get(2).cells().get(3).valuePerShare());
        assertEquals(DcfCalculator.calculate(assumptions(.01, .005)).valuePerShare(),
            grid.rows().get(2).cells().get(2).valuePerShare(), 1e-8);
        assertThrows(IllegalArgumentException.class, () -> DcfSensitivity.calculate(assumptions(.01, .02)));
    }
}
